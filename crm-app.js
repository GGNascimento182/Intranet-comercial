const monthInput=document.querySelector('#report-month');
const historyMode=document.querySelector('#history-mode');
const historyCutoff=document.querySelector('#history-cutoff');
const currentMonth=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
let dataset;
try{dataset=DashboardData.validate(window.SALESFORCE_DATA);}catch(error){document.querySelector('#connection-status').textContent=`Não foi possível carregar os dados: ${error.message}`;throw error;}
monthInput.value=dataset.asOfDate?.slice(0,7)||currentMonth;
if(dataset.range){monthInput.min=dataset.range.start;monthInput.max=dataset.range.end;}
historyCutoff.value=dataset.asOfDate?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):1;
const moneyField=dataset.rules.amountField==='Valor_Total_Calculado__c'?'Valor Total da Licença calculado':'Valor da oportunidade (Amount)';
document.querySelector('#source-details').innerHTML=`<ul><li>O time traz os cinco supervisores ativos e o grupo <strong>Desligados</strong>, que soma todos os demais supervisores e registros sem supervisor.</li><li>Agendamentos: leads por data de agendamento, incluindo convertidos.</li><li>Conexões: oportunidades com Resultado da Reunião = Conectada, por data da reunião; uma contagem por oportunidade.</li><li>Vendas: oportunidades com Data da venda preenchida, excluindo as atualmente perdidas. Receita e TM usam ${escapeHTML(moneyField)}, independentemente do pagamento.</li><li>Pipeline: oportunidades abertas na extração, por mês previsto de fechamento. Pode incluir vendas que ainda constam como abertas no CRM.</li><li>MTD compara o acumulado até a mesma posição de dia útil em cada mês. Fins de semana e feriados nacionais não entram no cálculo; meses curtos terminam em seu último dia útil.</li><li>A carga é uma fotografia da extração. Para atualizar, execute sync-salesforce.ps1 e recarregue esta página.</li></ul>${dataset.warnings?.length?`<h3>Qualidade dos dados</h3><ul>${dataset.warnings.map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul>`:''}`;
function renderHistory(){
  const month=monthInput.value;
  if(!monthInput.validity.valid||!month)return;
  const months=DashboardData.monthsThrough(month),mtd=historyMode.value==='mtd';
  const asOfMonth=dataset.asOfDate?.slice(0,7);
  const maxOrdinal=asOfMonth&&months.includes(asOfMonth)?DashboardData.businessDayOrdinal(dataset.asOfDate,dataset):Math.max(...months.map(m=>DashboardData.businessDaysInMonth(m,dataset)));
  historyCutoff.max=maxOrdinal;
  if(Number(historyCutoff.value)>maxOrdinal)historyCutoff.value=maxOrdinal;
  document.querySelector('#cutoff-label').hidden=!mtd;
  if(mtd&&(!historyCutoff.validity.valid||!historyCutoff.value))return;
  const day=mtd?Number(historyCutoff.value):null;
  const partial=dataset.coverage.some(c=>c.month===month&&c.partialPeriod);
  const periodLabel=mtd?`MTD · até o ${day}º dia útil`:partial?'Mês parcial até a extração':'Mês completo';
  const history=document.querySelector('#history-metrics');history.replaceChildren();
  DashboardData.definitions.filter(d=>d.source!=='dialer').forEach(definition=>{
    const card=document.createElement('monthly-history');
    card.data={definition,periodLabel,comparable:mtd||!partial,points:months.map(m=>{const cutoff=mtd?DashboardData.businessDayCutoff(m,day,dataset):null;return {month:m,value:DashboardData.valueFor(dataset,m,definition.key,undefined,cutoff)};})};history.append(card);
  });
  document.querySelector('#history-period').textContent=`${monthLabel(months[0])} a ${monthLabel(month)} · ${mtd?`MTD: até o ${day}º dia útil de cada mês`:'meses completos; mês da extração pode estar parcial'} · 5 supervisores + desligados`;
}
function renderDashboard(){
  if(!monthInput.validity.valid||!monthInput.value)return;
  const month=monthInput.value,previous=DashboardData.monthsThrough(month).at(-2);
  const partial=dataset.coverage.some(c=>c.month===month&&c.partialPeriod);
  const macro=document.querySelector('#macro-metrics');macro.replaceChildren();
  DashboardData.definitions.forEach(definition=>{
    const card=document.createElement('crm-metric');
    card.data={definition,value:DashboardData.valueFor(dataset,month,definition.key),previous:partial||definition.key==='pipeline'?null:DashboardData.valueFor(dataset,previous,definition.key)};macro.append(card);
  });
  document.querySelector('crm-team').data={dataset,month};
  document.querySelector('#connection-status').textContent=dataset.extractedAt?`Salesforce · extração ${new Date(dataset.extractedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília) · 5 supervisores e desligados. ${partial?'Mês parcial até a extração.':''} Ligações indisponíveis: discador não conectado. “—” indica dados ausentes ou incompletos.`:'Salesforce aguardando carga pela CLI.';
  renderHistory();
}
monthInput.addEventListener('change',renderDashboard);
historyMode.addEventListener('change',renderHistory);
historyCutoff.addEventListener('change',renderHistory);
document.querySelector('#chart-style').addEventListener('change',event=>document.body.classList.toggle('line-charts',event.target.value==='line'));
function activateView(){const allowed=new Set([...document.querySelectorAll('[data-view]')].map(el=>el.dataset.view));let target=location.hash.slice(1);if(target==='times'||target==='historico')target='dashboard';if(!allowed.has(target))target='dashboard';document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==target);document.querySelectorAll('[data-view-link]').forEach(link=>{const active=link.dataset.viewLink===target;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});}
window.addEventListener('hashchange',activateView);
renderDashboard();
activateView();
