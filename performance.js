const performanceMonth=document.querySelector('#performance-month');
const performanceStatus=document.querySelector('#performance-status');
const performanceTeams=document.querySelector('#performance-teams');
const personHistoryMode=document.querySelector('#person-history-mode');
const hunterPerson=document.querySelector('#hunter-person');
const closerPerson=document.querySelector('#closer-person');
const dailyRole=document.querySelector('#daily-role');
const dailyPerson=document.querySelector('#daily-person');
const dailyMonth=document.querySelector('#daily-month');
const hunterIndicatorHistoryMetric=document.querySelector('#hunter-indicator-history-metric');
const closerIndicatorHistoryMetric=document.querySelector('#closer-indicator-history-metric');
const hunterIndicatorPeopleHistory=document.querySelector('#hunter-indicator-people-history');
const closerIndicatorPeopleHistory=document.querySelector('#closer-indicator-people-history');

const performanceFormat=(value,definition)=>value===null?'—':new Intl.NumberFormat('pt-BR',definition.percent?{style:'percent',maximumFractionDigits:0}:definition.money?{style:'currency',currency:'BRL',maximumFractionDigits:0}:{maximumFractionDigits:0}).format(value);
const optionsFor=role=>SupabaseData.membersFor(supabaseDataset,role).map(member=>`<option value="${escapeHTML(member.id)}">${escapeHTML(member.name)}</option>`).join('');
const indicatorHistoryDefinitions=role=>SupabaseData.definitions[role].filter(definition=>role!=='closer'||!['futureMeetings','pendingAmount','gapDue'].includes(definition.key));
function valueCell(role,definition,memberId,month,cutoff=null){
  const value=SupabaseData.valueFor(supabaseDataset,month,role,definition.key,memberId,cutoff);
  if(definition.shareOfAppointments){
    const appointments=SupabaseData.valueFor(supabaseDataset,month,role,'appointmentsReceived',memberId,cutoff);
    return value===null||appointments===null?'—':`${performanceFormat(value,{})} | ${appointments>0?Math.round((value/appointments)*100):0}%`;
  }
  if(!definition.volumeKey)return performanceFormat(value,definition);
  const volume=SupabaseData.valueFor(supabaseDataset,month,role,definition.volumeKey,memberId,cutoff);
  return value===null||volume===null?'—':`${performanceFormat(value,definition)} (${performanceFormat(volume,{})})`;
}
function dailyValueCell(role,definition,memberId,date){
  const value=SupabaseData.dailyValueFor(supabaseDataset,date,role,definition.key,memberId);
  if(definition.shareOfAppointments){
    const appointments=SupabaseData.dailyValueFor(supabaseDataset,date,role,'appointmentsReceived',memberId);
    return value===null||appointments===null?'—':`${performanceFormat(value,{})} | ${appointments>0?Math.round((value/appointments)*100):0}%`;
  }
  if(!definition.volumeKey)return performanceFormat(value,definition);
  const volume=SupabaseData.dailyValueFor(supabaseDataset,date,role,definition.volumeKey,memberId);
  return value===null||volume===null?'—':`${performanceFormat(value,definition)} (${performanceFormat(volume,{})})`;
}
function configurePerformance(){
  const month=supabaseDataset.asOfDate?.slice(0,7)||currentMonth;
  performanceMonth.value=month;dailyMonth.value=month;
  if(supabaseDataset.range){performanceMonth.min=dailyMonth.min=supabaseDataset.range.start;performanceMonth.max=dailyMonth.max=supabaseDataset.range.end;}
  hunterPerson.innerHTML=optionsFor('hunter');closerPerson.innerHTML=optionsFor('closer');refreshDailyPeople();
}
function performanceTable(role,members,month){
  const defs=SupabaseData.definitions[role],cutoff=month===supabaseDataset.asOfDate?.slice(0,7)?supabaseDataset.asOfDate:null;
  const ids=members.map(member=>member.id),total=members.length?`<tfoot><tr><th scope="row">Total</th>${defs.map(definition=>`<td>${escapeHTML(valueCell(role,definition,ids,month,cutoff))}</td>`).join('')}</tr></tfoot>`:'';
  return `<div class="table-scroll"><table><thead><tr><th scope="col">Colaborador</th>${defs.map(definition=>`<th scope="col">${escapeHTML(definition.label)}</th>`).join('')}</tr></thead><tbody>${members.map(member=>`<tr><th scope="row">${escapeHTML(member.name)}</th>${defs.map(definition=>`<td>${escapeHTML(valueCell(role,definition,member.id,month,cutoff))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${defs.length+1}" class="empty-state">Nenhum colaborador ativo neste time.</td></tr>`}</tbody>${total}</table></div>`;
}
function renderPerformanceTeams(){
  const month=performanceMonth.value;if(!month)return;
  const roleSection=(role,title)=>{
    const allowed=(role==='closer'?supabaseDataset.supervisors.closer:supabaseDataset.supervisors.hunter).filter(supervisor=>role!=='hunter'||!/^Thais Leite\b/i.test(supervisor.name));
    return `<section><h3 class="subsection-title">${escapeHTML(title)}</h3><div class="team-stack">${allowed.map(supervisor=>{const members=SupabaseData.membersFor(supabaseDataset,role,{supervisorId:supervisor.id});return `<details class="team-detail"><summary>${escapeHTML(supervisor.name)} <span>${members.length} pessoas</span></summary>${performanceTable(role,members,month)}</details>`;}).join('')}</div></section>`;
  };
  performanceTeams.innerHTML=roleSection('hunter','Hunters')+roleSection('closer','Closers · Matheus e Patrick');
  performanceStatus.textContent=`Período: ${monthLabel(month)} · CNPJ ligado considera duração ≥ 0; atendido, duração diferente de 0. Snapshot do Supabase em ${supabaseDataset.extractedAt?new Date(supabaseDataset.extractedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'carga pendente'}.`;
}
function monthsTo(selected){const year=selected.slice(0,4);return Array.from({length:Number(selected.slice(5,7))},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`);}
function historyTable(role,memberId){
  const months=monthsTo(performanceMonth.value),mtd=personHistoryMode.value==='mtd',ordinal=dataset.asOfDate?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):1;
  const defs=SupabaseData.definitions[role];
  return `<div class="table-scroll"><table class="matrix-table"><thead><tr><th scope="col">Indicador</th>${months.map(month=>`<th scope="col">${escapeHTML(monthLabel(month))}</th>`).join('')}</tr></thead><tbody>${defs.map(definition=>`<tr><th scope="row">${escapeHTML(definition.label)}</th>${months.map(month=>{const cutoff=mtd?DashboardData.businessDayCutoff(month,ordinal,dataset):null;return `<td>${escapeHTML(valueCell(role,definition,memberId,month,cutoff))}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderPersonHistory(){document.querySelector('#hunter-history').innerHTML=historyTable('hunter',hunterPerson.value);document.querySelector('#closer-history').innerHTML=historyTable('closer',closerPerson.value);}
function indicatorHistoryMonths(){
  const first='2026-01',last=performanceMonth.value<'2026-01'?'2026-01':performanceMonth.value>'2026-12'?'2026-12':performanceMonth.value,months=[];
  for(let cursor=first;cursor<=last;){months.push(cursor);const [year,number]=cursor.split('-').map(Number);cursor=`${number===12?year+1:year}-${String(number===12?1:number+1).padStart(2,'0')}`;}
  return months;
}
function averageIndicatorCell(role,definition,memberIds,months){
  const ids=Array.isArray(memberIds)?memberIds:[memberIds],values=[],volumes=[],appointments=[];
  months.forEach(month=>ids.forEach(id=>{
    const value=SupabaseData.valueFor(supabaseDataset,month,role,definition.key,id);if(value!==null)values.push(value);
    if(definition.volumeKey){const volume=SupabaseData.valueFor(supabaseDataset,month,role,definition.volumeKey,id);if(volume!==null)volumes.push(volume);}
    if(definition.shareOfAppointments){const total=SupabaseData.valueFor(supabaseDataset,month,role,'appointmentsReceived',id);if(total!==null)appointments.push(total);}
  }));
  if(!values.length)return '—';
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  if(definition.shareOfAppointments){const total=appointments.reduce((sum,value)=>sum+value,0),result=values.reduce((sum,value)=>sum+value,0);return `${performanceFormat(mean,{})} | ${total>0?Math.round((result/total)*100):0}%`;}
  if(definition.volumeKey){const volume=volumes.length?volumes.reduce((sum,value)=>sum+value,0)/volumes.length:null;return volume===null?'—':`${performanceFormat(mean,definition)} (${performanceFormat(volume,{})})`;}
  return performanceFormat(mean,definition);
}
function totalIndicatorCell(role,definition,memberIds,months){
  const ids=Array.isArray(memberIds)?memberIds:[memberIds],values=months.map(month=>SupabaseData.valueFor(supabaseDataset,month,role,definition.key,ids)).filter(value=>value!==null);
  if(!values.length)return '—';
  if(definition.percent){
    const connections=months.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,'connections',ids)||0),0);
    const soldDeals=months.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,'soldDeals',ids)||0),0);
    return connections>0?performanceFormat(soldDeals/connections,definition):'—';
  }
  const total=values.reduce((sum,value)=>sum+value,0);
  if(definition.shareOfAppointments){
    const appointments=months.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,'appointmentsReceived',ids)||0),0);
    return `${performanceFormat(total,{})} | ${appointments>0?Math.round((total/appointments)*100):0}%`;
  }
  if(definition.volumeKey){
    const volume=months.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,definition.volumeKey,ids)||0),0);
    return `${performanceFormat(total,definition)} (${performanceFormat(volume,{})})`;
  }
  return performanceFormat(total,definition);
}
function averageTeamTotalCell(role,definition,memberIds,months){
  const ids=Array.isArray(memberIds)?memberIds:[memberIds],validMonths=months.filter(month=>SupabaseData.valueFor(supabaseDataset,month,role,definition.key,ids)!==null);
  if(!validMonths.length)return '—';
  if(definition.percent)return totalIndicatorCell(role,definition,ids,validMonths);
  const divisor=validMonths.length;
  if(definition.shareOfAppointments){
    const result=validMonths.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,definition.key,ids)||0),0);
    const appointments=validMonths.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,'appointmentsReceived',ids)||0),0);
    return `${performanceFormat(result/divisor,{})} | ${appointments>0?Math.round((result/appointments)*100):0}%`;
  }
  if(definition.volumeKey){
    const amount=validMonths.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,definition.key,ids)||0),0);
    const volume=validMonths.reduce((sum,month)=>sum+(SupabaseData.valueFor(supabaseDataset,month,role,definition.volumeKey,ids)||0),0);
    return `${performanceFormat(amount/divisor,definition)} (${performanceFormat(volume/divisor,{})})`;
  }
  const values=validMonths.map(month=>SupabaseData.valueFor(supabaseDataset,month,role,definition.key,ids));
  return performanceFormat(values.reduce((sum,value)=>sum+value,0)/divisor,definition);
}
function refreshIndicatorMetricOptions(role,select){
  const definitions=indicatorHistoryDefinitions(role),selected=select.value;
  select.innerHTML=definitions.map(definition=>`<option value="${escapeHTML(definition.key)}">${escapeHTML(definition.label)}</option>`).join('');
  if(definitions.some(definition=>definition.key===selected))select.value=selected;
}
function indicatorPeopleTable(role,supervisor,definition,months,isOpen=false){
  const members=SupabaseData.membersFor(supabaseDataset,role,{supervisorId:supervisor.id}),ids=members.map(member=>member.id);
  return `<details class="team-detail" data-supervisor-id="${escapeHTML(supervisor.id)}"${isOpen?' open':''}><summary>${escapeHTML(supervisor.name)} <span>${members.length} pessoas</span></summary><div class="table-scroll"><table class="matrix-table indicator-people-table"><thead><tr><th scope="col">Colaborador</th>${months.map(month=>`<th scope="col">${escapeHTML(monthLabel(month))}</th>`).join('')}<th scope="col">Média</th><th scope="col">Total</th></tr></thead><tbody>${members.map(member=>`<tr><th scope="row">${escapeHTML(member.name)}</th>${months.map(month=>`<td>${escapeHTML(valueCell(role,definition,member.id,month))}</td>`).join('')}<td>${escapeHTML(averageIndicatorCell(role,definition,member.id,months))}</td><td>${escapeHTML(totalIndicatorCell(role,definition,member.id,months))}</td></tr>`).join('')||`<tr><td colspan="${months.length+3}" class="empty-state">Nenhum colaborador ativo neste time.</td></tr>`}</tbody><tfoot><tr><th scope="row">Média do time</th>${months.map(month=>`<td>${escapeHTML(averageIndicatorCell(role,definition,ids,[month]))}</td>`).join('')}<td>${escapeHTML(averageIndicatorCell(role,definition,ids,months))}</td><td>—</td></tr><tr><th scope="row">Total do time</th>${months.map(month=>`<td>${escapeHTML(totalIndicatorCell(role,definition,ids,[month]))}</td>`).join('')}<td>${escapeHTML(averageTeamTotalCell(role,definition,ids,months))}</td><td>${escapeHTML(totalIndicatorCell(role,definition,ids,months))}</td></tr></tfoot></table></div></details>`;
}
function renderIndicatorPeopleHistory(role,select,target){
  const definition=indicatorHistoryDefinitions(role).find(item=>item.key===select.value),months=indicatorHistoryMonths();if(!definition||!months.length){target.innerHTML='<div class="empty-state">Selecione um período de 2026 para consultar o histórico.</div>';return;}
  const supervisors=(supabaseDataset.supervisors?.[role]||[]).filter(supervisor=>role!=='hunter'||!/^Thais Leite\b/i.test(supervisor.name));
  const expanded=new Set([...target.querySelectorAll('details.team-detail[open][data-supervisor-id]')].map(team=>team.dataset.supervisorId));
  target.innerHTML=supervisors.map(supervisor=>indicatorPeopleTable(role,supervisor,definition,months,expanded.has(supervisor.id))).join('')||'<div class="empty-state">Nenhum time disponível.</div>';
}
function renderAllIndicatorPeopleHistory(){renderIndicatorPeopleHistory('hunter',hunterIndicatorHistoryMetric,hunterIndicatorPeopleHistory);renderIndicatorPeopleHistory('closer',closerIndicatorHistoryMetric,closerIndicatorPeopleHistory);}
function refreshDailyPeople(){dailyPerson.innerHTML=optionsFor(dailyRole.value);}
function renderDaily(){
  const role=dailyRole.value,memberId=dailyPerson.value,month=dailyMonth.value;if(!memberId||!month)return;
  const days=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(),defs=SupabaseData.definitions[role];
  const dates=Array.from({length:days},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
  document.querySelector('#daily-history').innerHTML=`<div class="table-scroll"><table class="matrix-table daily-matrix"><thead><tr><th scope="col">Indicador</th>${dates.map(date=>`<th scope="col">${date.slice(8)}</th>`).join('')}</tr></thead><tbody>${defs.map(definition=>`<tr><th scope="row">${escapeHTML(definition.label)}</th>${dates.map(date=>`<td>${escapeHTML(dailyValueCell(role,definition,memberId,date))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderPerformance(){renderPerformanceTeams();renderPersonHistory();renderAllIndicatorPeopleHistory();renderDaily();}
performanceMonth.addEventListener('change',renderPerformance);personHistoryMode.addEventListener('change',renderPersonHistory);hunterPerson.addEventListener('change',renderPersonHistory);closerPerson.addEventListener('change',renderPersonHistory);
dailyRole.addEventListener('change',()=>{refreshDailyPeople();renderDaily();});dailyPerson.addEventListener('change',renderDaily);dailyMonth.addEventListener('change',renderDaily);
hunterIndicatorHistoryMetric.addEventListener('change',()=>renderIndicatorPeopleHistory('hunter',hunterIndicatorHistoryMetric,hunterIndicatorPeopleHistory));closerIndicatorHistoryMetric.addEventListener('change',()=>renderIndicatorPeopleHistory('closer',closerIndicatorHistoryMetric,closerIndicatorPeopleHistory));
configurePerformance();refreshIndicatorMetricOptions('hunter',hunterIndicatorHistoryMetric);refreshIndicatorMetricOptions('closer',closerIndicatorHistoryMetric);renderPerformance();
