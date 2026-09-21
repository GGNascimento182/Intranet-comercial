const performanceMonth=document.querySelector('#performance-month');
const performanceStatus=document.querySelector('#performance-status');
const performanceTeams=document.querySelector('#performance-teams');
const personHistoryMode=document.querySelector('#person-history-mode');
const hunterPerson=document.querySelector('#hunter-person');
const closerPerson=document.querySelector('#closer-person');
const dailyRole=document.querySelector('#daily-role');
const dailyPerson=document.querySelector('#daily-person');
const dailyMonth=document.querySelector('#daily-month');

const performanceFormat=(value,definition)=>value===null?'—':new Intl.NumberFormat('pt-BR',definition.money?{style:'currency',currency:'BRL',maximumFractionDigits:0}:{maximumFractionDigits:0}).format(value);
const optionsFor=role=>SupabaseData.membersFor(supabaseDataset,role).map(member=>`<option value="${escapeHTML(member.id)}">${escapeHTML(member.name)}</option>`).join('');
function configurePerformance(){
  const month=supabaseDataset.asOfDate?.slice(0,7)||currentMonth;
  performanceMonth.value=month;dailyMonth.value=month;
  if(supabaseDataset.range){performanceMonth.min=dailyMonth.min=supabaseDataset.range.start;performanceMonth.max=dailyMonth.max=supabaseDataset.range.end;}
  hunterPerson.innerHTML=optionsFor('hunter');closerPerson.innerHTML=optionsFor('closer');refreshDailyPeople();
}
function memberIdsForSupervisor(role,id){return SupabaseData.membersFor(supabaseDataset,role,{supervisorId:id}).map(member=>member.id);}
function performanceTable(role,members,month){
  const defs=SupabaseData.definitions[role],cutoff=month===supabaseDataset.asOfDate?.slice(0,7)?supabaseDataset.asOfDate:null;
  return `<div class="table-scroll"><table><thead><tr><th scope="col">Colaborador</th>${defs.map(definition=>`<th scope="col">${escapeHTML(definition.label)}</th>`).join('')}</tr></thead><tbody>${members.map(member=>`<tr><th scope="row">${escapeHTML(member.name)}</th>${defs.map(definition=>`<td>${escapeHTML(performanceFormat(SupabaseData.valueFor(supabaseDataset,month,role,definition.key,member.id,cutoff),definition))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${defs.length+1}" class="empty-state">Nenhum colaborador ativo neste time.</td></tr>`}</tbody></table></div>`;
}
function renderPerformanceTeams(){
  const month=performanceMonth.value;if(!month)return;
  const roleSection=(role,title)=>{
    const allowed=role==='closer'?supabaseDataset.supervisors.closer:supabaseDataset.supervisors.hunter;
    return `<section><h3 class="subsection-title">${escapeHTML(title)}</h3><div class="team-stack">${allowed.map(supervisor=>{const members=SupabaseData.membersFor(supabaseDataset,role,{supervisorId:supervisor.id});return `<details class="team-detail" open><summary>${escapeHTML(supervisor.name)} <span>${members.length} pessoas</span></summary>${performanceTable(role,members,month)}</details>`;}).join('')}</div></section>`;
  };
  performanceTeams.innerHTML=roleSection('hunter','Hunters')+roleSection('closer','Closers · Matheus e Patrick');
  performanceStatus.textContent=`Período: ${monthLabel(month)} · snapshot do Supabase em ${supabaseDataset.extractedAt?new Date(supabaseDataset.extractedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'carga pendente'}.`;
}
function monthsTo(selected){const year=selected.slice(0,4);return Array.from({length:Number(selected.slice(5,7))},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`);}
function historyTable(role,memberId){
  const months=monthsTo(performanceMonth.value),mtd=personHistoryMode.value==='mtd',ordinal=dataset.asOfDate?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):1;
  const defs=SupabaseData.definitions[role];
  return `<div class="table-scroll"><table class="matrix-table"><thead><tr><th scope="col">Indicador</th>${months.map(month=>`<th scope="col">${escapeHTML(monthLabel(month))}</th>`).join('')}</tr></thead><tbody>${defs.map(definition=>`<tr><th scope="row">${escapeHTML(definition.label)}</th>${months.map(month=>{const cutoff=mtd?DashboardData.businessDayCutoff(month,ordinal,dataset):null;return `<td>${escapeHTML(performanceFormat(SupabaseData.valueFor(supabaseDataset,month,role,definition.key,memberId,cutoff),definition))}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderPersonHistory(){document.querySelector('#hunter-history').innerHTML=historyTable('hunter',hunterPerson.value);document.querySelector('#closer-history').innerHTML=historyTable('closer',closerPerson.value);}
function refreshDailyPeople(){dailyPerson.innerHTML=optionsFor(dailyRole.value);}
function renderDaily(){
  const role=dailyRole.value,memberId=dailyPerson.value,month=dailyMonth.value;if(!memberId||!month)return;
  const days=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(),defs=SupabaseData.definitions[role];
  const dates=Array.from({length:days},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
  document.querySelector('#daily-history').innerHTML=`<div class="table-scroll"><table class="matrix-table daily-matrix"><thead><tr><th scope="col">Indicador</th>${dates.map(date=>`<th scope="col">${date.slice(8)}</th>`).join('')}</tr></thead><tbody>${defs.map(definition=>`<tr><th scope="row">${escapeHTML(definition.label)}</th>${dates.map(date=>`<td>${escapeHTML(performanceFormat(SupabaseData.dailyValueFor(supabaseDataset,date,role,definition.key,memberId),definition))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderPerformance(){renderPerformanceTeams();renderPersonHistory();renderDaily();}
performanceMonth.addEventListener('change',renderPerformance);personHistoryMode.addEventListener('change',renderPersonHistory);hunterPerson.addEventListener('change',renderPersonHistory);closerPerson.addEventListener('change',renderPersonHistory);
dailyRole.addEventListener('change',()=>{refreshDailyPeople();renderDaily();});dailyPerson.addEventListener('change',renderDaily);dailyMonth.addEventListener('change',renderDaily);
configurePerformance();renderPerformance();
