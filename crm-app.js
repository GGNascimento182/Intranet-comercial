const monthInput=document.querySelector('#report-month');
const historyMode=document.querySelector('#history-mode');
const historyCutoff=document.querySelector('#history-cutoff');
const currentMonth=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
let dataset,supabaseDataset;
try{dataset=DashboardData.validate(window.SALESFORCE_DATA);supabaseDataset=SupabaseData.validate(window.SUPABASE_DATA);}catch(error){document.querySelector('#connection-status').textContent=`Não foi possível carregar os dados: ${error.message}`;throw error;}
monthInput.value=dataset.asOfDate?.slice(0,7)||currentMonth;
if(dataset.range){monthInput.min=dataset.range.start;monthInput.max=dataset.range.end;}
historyCutoff.value=dataset.asOfDate?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):1;
const moneyField=dataset.rules.amountField==='Valor_Total_Calculado__c'?'Valor Total da Licença calculado':'Valor da oportunidade (Amount)';
document.querySelector('#source-details').innerHTML=`<ul><li>Receita: soma de ${escapeHTML(moneyField)} apenas das oportunidades ganhas, alocadas pelo mês de fechamento.</li><li>Ligações: tarefas de chamada do Supabase. O número principal deduplica o vínculo CRM do CNPJ; o número menor mostra todas as ligações.</li><li>Agendamentos: leads por data de agendamento, incluindo convertidos.</li><li>Conexões: oportunidades com Resultado da Reunião = Conectada, por data da reunião.</li><li>Pipeline: oportunidades abertas, com Closer atribuído e fechamento previsto no mês selecionado. Não integra o histórico.</li><li>MTD usa a mesma posição de dia útil em todos os meses.</li><li>As credenciais ficam somente na automação que gera os snapshots; o navegador recebe apenas agregados.</li></ul>${dataset.warnings?.length?`<h3>Qualidade dos dados</h3><ul>${dataset.warnings.map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul>`:''}`;

function supabaseMetric(month,key,memberIds=undefined,cutoff=null){
  const map={calls:'calledCnpjs',answered:'answeredCnpjs'};
  return SupabaseData.valueFor(supabaseDataset,month,'hunter',map[key]||key,memberIds,cutoff);
}
function dashboardMetric(month,key,supervisorId=undefined,cutoff=null){
  if(key==='calls'||key==='answered'){
    let ids;
    if(supervisorId!==undefined){const supervisor=supabaseDataset.supervisors.hunter.find(item=>item.sfUserId===supervisorId);ids=supervisor?SupabaseData.membersFor(supabaseDataset,'hunter',{activeOnly:false,supervisorId:supervisor.id}).map(member=>member.id):[];}
    return supabaseMetric(month,key,ids,cutoff);
  }
  return DashboardData.valueFor(dataset,month,key,supervisorId,cutoff);
}
const overviewDefinitions=[
  {key:'calls',label:'Ligações efetuadas',icon:'phone',tone:'blue',source:'supabase'},
  {key:'answeredCalls',label:'Ligações atendidas',icon:'answered',tone:'purple',source:'supabase',rate:['answeredCalls','calls'],rateLabel:'atendidas'},
  {key:'appointments',label:'Agendamentos',icon:'calendar',tone:'blue',rate:['appointments','answeredCalls'],rateLabel:'agendados'},
  {key:'connections',label:'Conexões',icon:'link',tone:'purple',rate:['connections','appointments'],rateLabel:'conexões'},
  {key:'totalSales',label:'Vendas',icon:'cart',tone:'orange',rate:['totalSales','connections'],rateLabel:'vendas'},
  {key:'totalRevenue',label:'Vendas (R$)',icon:'money',tone:'orange',money:true},
  {key:'sales',label:'Pago',icon:'cart',tone:'green'},
  {key:'revenue',label:'Pago (R$)',icon:'money',tone:'green',money:true}
];
function overviewMetric(month,key,cutoff=null){
  if(key==='calls'||key==='answeredCalls')return SupabaseData.valueFor(supabaseDataset,month,'hunter',key,undefined,cutoff);
  return DashboardData.valueFor(dataset,month,key,undefined,cutoff);
}
function overviewRate(month,definition,cutoff=null){
  if(!definition.rate)return null;
  const [numeratorKey,denominatorKey]=definition.rate,numerator=overviewMetric(month,numeratorKey,cutoff),denominator=overviewMetric(month,denominatorKey,cutoff);
  return numerator===null||denominator===null||denominator===0?null:numerator/denominator;
}
const planKey={revenue:'revenue',calls:'calls',answered:null,appointments:'appointments',connections:'meetings',sales:'sales',ticket:'ticket'};
function planComparison(month,definition,value){
  if(definition.key==='pipeline')return null;
  const key=planKey[definition.key],full=key?window.BUSINESS_PLAN?.months?.[month]?.[key]:null;
  const targetDate=month===dataset.asOfDate?.slice(0,7)?dataset.asOfDate:DashboardData.businessDayCutoff(month,DashboardData.businessDaysInMonth(month,dataset),dataset);
  const ratio=targetDate?DashboardData.businessDayOrdinal(targetDate,dataset)/Math.max(1,DashboardData.businessDaysInMonth(month,dataset)):1;
  const planned=full===null||full===undefined?null:definition.key==='ticket'?full:full*ratio;
  const actual=definition.key==='calls'?SupabaseData.valueFor(supabaseDataset,month,'hunter','calls'):value;
  const gap=actual===null||planned===null?null:actual-planned,attainment=actual===null||!planned?null:actual/planned;
  const format=v=>v===null?'—':formatMetric(v,definition);
  return {actual:format(actual),planned:format(planned),gap:gap===null?'—':`${gap>0?'+':''}${format(gap)}`,attainment:attainment===null?'—':`${(attainment*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`,negative:gap!==null&&gap<0};
}
function renderHistory(){
  const month=monthInput.value;if(!monthInput.validity.valid||!month)return;
  const months=DashboardData.monthsThrough(month),mtd=historyMode.value==='mtd';
  const asOfMonth=dataset.asOfDate?.slice(0,7);
  const maxOrdinal=asOfMonth&&months.includes(asOfMonth)?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):Math.max(...months.map(m=>DashboardData.businessDaysInMonth(m,dataset)));
  historyCutoff.max=maxOrdinal;if(Number(historyCutoff.value)>maxOrdinal)historyCutoff.value=maxOrdinal;
  document.querySelector('#cutoff-label').hidden=!mtd;if(mtd&&(!historyCutoff.validity.valid||!historyCutoff.value))return;
  const day=mtd?Number(historyCutoff.value):null,partial=dataset.coverage.some(c=>c.month===month&&c.partialPeriod);
  const periodLabel=mtd?`MTD · até o ${day}º dia útil`:partial?'Mês parcial até a extração':'Mês completo';
  const history=document.querySelector('#history-metrics');history.replaceChildren();
  overviewDefinitions.forEach(definition=>{
    const card=document.createElement('monthly-history');
    const cutoff=mtd?DashboardData.businessDayCutoff(month,day,dataset):null,rate=overviewRate(month,definition,cutoff);
    card.data={definition,periodLabel,comparable:mtd||!partial,conversion:rate===null?null:`${(rate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% ${definition.rateLabel}`,points:months.map(m=>{const pointCutoff=mtd?DashboardData.businessDayCutoff(m,day,dataset):null;return {month:m,value:overviewMetric(m,definition.key,pointCutoff)};})};history.append(card);
  });
  document.querySelector('#history-period').textContent=`${monthLabel(months[0])} a ${monthLabel(month)} · ${mtd?`MTD: até o ${day}º dia útil de cada mês`:'meses completos; mês da extração pode estar parcial'}`;
}
function renderDashboard(){
  if(!monthInput.validity.valid||!monthInput.value)return;
  const month=monthInput.value,previous=DashboardData.monthsThrough(month).at(-2),partial=dataset.coverage.some(c=>c.month===month&&c.partialPeriod);
  document.querySelector('crm-team').data={dataset,supabase:supabaseDataset,month};
  document.querySelector('crm-closer-team').data={dataset,supabase:supabaseDataset,month};
  const sfTime=dataset.extractedAt?new Date(dataset.extractedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'aguardando carga';
  const sbTime=supabaseDataset.extractedAt?new Date(supabaseDataset.extractedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'aguardando carga';
  document.querySelector('#connection-status').textContent=`Salesforce: ${sfTime} · Supabase: ${sbTime}. ${partial?'Mês parcial até a extração. ':''}“—” indica dado ausente ou incompleto.`;
  renderHistory();
}
monthInput.addEventListener('change',renderDashboard);historyMode.addEventListener('change',renderHistory);historyCutoff.addEventListener('change',renderHistory);
document.querySelector('#chart-style').addEventListener('change',event=>document.body.classList.toggle('line-charts',event.target.value==='line'));
function activateView(){const allowed=new Set([...document.querySelectorAll('[data-view]')].map(el=>el.dataset.view));let target=location.hash.slice(1);if(target==='times'||target==='historico')target='dashboard';if(!allowed.has(target))target='dashboard';document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==target);document.querySelectorAll('[data-view-link]').forEach(link=>{const active=link.dataset.viewLink===target;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});}
window.addEventListener('hashchange',activateView);renderDashboard();activateView();
