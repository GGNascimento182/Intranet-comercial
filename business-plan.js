const bpMonthInput=document.querySelector('#bp-month');
const bpStatus=document.querySelector('#bp-status');
const bpTable=document.querySelector('#bp-table');
const bpWeekly=document.querySelector('#bp-weekly');
const bpHistory=document.querySelector('#bp-history');
const bpMonthLabel=month=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
const bpNumber=value=>value===null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(value);
const bpMoney=value=>value===null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(value);
const bpPercent=value=>value===null?'—':`${(value*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
const bpPp=value=>value===null?'—':`${value>=0?'+':''}${(value*100).toLocaleString('pt-BR',{maximumFractionDigits:2})} p.p.`;
const bpGap=(value,type)=>value===null?'—':type==='rate'?bpPp(value):type==='money'?`${value>=0?'+':''}${bpMoney(value)}`:`${value>=0?'+':''}${bpNumber(value)}`;
function bpDefinition(month){const plan=window.BUSINESS_PLAN.months[month];const received=key=>DashboardData.valueFor(dataset,month,key);const appointments=received('appointments'),meetings=received('connections'),sales=received('sales'),revenue=received('revenue');const workedCnpjs=SupabaseData.valueFor(supabaseDataset,month,'hunter','calledCnpjs'),totalCalls=SupabaseData.valueFor(supabaseDataset,month,'hunter','calls');return [
  {key:'calls',label:'Ligações / CNPJs trabalhados',type:'count',plan:plan?.calls??null,actual:workedCnpjs,comparisonActual:totalCalls,detail:totalCalls===null?null:`${bpNumber(totalCalls)} ligações no total`},
  {key:'schedulingRate',label:'Tx Ag.',type:'rate',plan:plan?.schedulingRate??null,actual:totalCalls===null||totalCalls===0||appointments===null?null:appointments/totalCalls},
  {key:'appointments',label:'Agendamentos',type:'count',plan:plan?.appointments??null,actual:appointments},
  {key:'connectionRate',label:'Tx Conexões',type:'rate',plan:plan?.connectionRate??null,actual:appointments===null||appointments===0||meetings===null?null:meetings/appointments},
  {key:'meetings',label:'Reuniões',type:'count',plan:plan?.meetings??null,actual:meetings},
  {key:'conversionRate',label:'Tx Conversão',type:'rate',plan:plan?.conversionRate??null,actual:meetings===null||meetings===0||sales===null?null:sales/meetings},
  {key:'sales',label:'Vendas',type:'count',plan:plan?.sales??null,actual:sales},
  {key:'revenue',label:'Receita',type:'money',plan:plan?.revenue??null,actual:revenue},
  {key:'ticket',label:'TM',type:'money',plan:plan?.ticket??null,actual:DashboardData.valueFor(dataset,month,'ticket'),fixedPlan:true}
];}
const bpNormalizedName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
function bpWeeklyPeriods(month){
  const first=new Date(`${month}-01T00:00:00Z`),start=new Date(first);
  start.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));
  const monthEnd=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0));
  return Array.from({length:5},(_,index)=>{
    const from=new Date(start);from.setUTCDate(start.getUTCDate()+index*7);
    const to=new Date(from);to.setUTCDate(from.getUTCDate()+6);
    return {key:`S${index+1}`,from:`${from.toISOString().slice(0,10)}`,to:`${to.toISOString().slice(0,10)}`,active:to>=first&&from<=monthEnd};
  });
}
function bpWeeklyMemberIds(team){
  const members=SupabaseData.membersFor(supabaseDataset,'closer',{activeOnly:false});
  if(team.supervisor){
    const supervisor=(supabaseDataset.supervisors.closer||[]).find(item=>bpNormalizedName(item.name)===bpNormalizedName(team.supervisor));
    return {ids:supervisor?members.filter(member=>member.supervisorId===supervisor.id).map(member=>member.id):[],missing:supervisor?[ ]:[team.supervisor]};
  }
  const requested=new Set((team.members||[]).map(bpNormalizedName));
  const found=members.filter(member=>requested.has(bpNormalizedName(member.name)));
  return {ids:found.map(member=>member.id),missing:(team.members||[]).filter(name=>!found.some(member=>bpNormalizedName(member.name)===bpNormalizedName(name)))};
}
function bpWeeklyAmount(memberIds,period,field){
  const selected=new Set(memberIds);
  return supabaseDataset.dailyRows.filter(row=>row.role==='closer'&&selected.has(row.memberId)&&row.date>=period.from&&row.date<=period.to).reduce((sum,row)=>sum+(Number(row[field])||0),0);
}
function bpWeeklyRow(label,values,{total=false,kind=''}={}){const monthTotal=values.reduce((sum,value)=>sum+value,0);return `<tr class="${total?'bp-weekly-total ':''}${kind?`bp-weekly-${kind}`:''}"><th scope="row">${escapeHTML(label)}</th>${values.map(value=>`<td>${bpMoney(value)}</td>`).join('')}<td>${bpMoney(monthTotal)}</td></tr>`;}
function bpWeeklyPercentRow(label,actual,target){const values=actual.map((value,index)=>target[index]===0?null:value/target[index]);const monthActual=actual.reduce((sum,value)=>sum+value,0),monthTarget=target.reduce((sum,value)=>sum+value,0);return `<tr class="bp-weekly-rate"><th scope="row">${escapeHTML(label)}</th>${values.map(value=>`<td>${bpPercent(value)}</td>`).join('')}<td>${bpPercent(monthTarget===0?null:monthActual/monthTarget)}</td></tr>`;}
function bpRenderWeekly(month){
  const config=window.BUSINESS_PLAN.weeklyCloserPlan?.[month];
  if(!config){bpWeekly.innerHTML=`<div class="empty-state">A distribuição semanal de meta ainda não foi cadastrada para ${escapeHTML(bpMonthLabel(month))}.</div>`;return;}
  const periods=bpWeeklyPeriods(month),warnings=[];
  const teams=config.teams.map(team=>{
    const members=bpWeeklyMemberIds(team);if(members.missing.length)warnings.push(`${team.label}: ${members.missing.join(', ')}`);
    return {...team,memberIds:members.ids,realized:periods.map(period=>bpWeeklyAmount(members.ids,period,'soldAmount')),paid:periods.map(period=>bpWeeklyAmount(members.ids,period,'paidAmount'))};
  });
  const totalFor=key=>periods.map((_,index)=>teams.reduce((sum,team)=>sum+team[key][index],0));
  const targets=totalFor('targets'),realized=totalFor('realized'),paid=totalFor('paid');
  const section=(title,rows,total,kind)=>`<tr class="bp-weekly-section"><th colspan="7">${title}</th></tr>${rows.map(team=>bpWeeklyRow(team.short||team.label.split(' — ')[0],team[kind],{kind})).join('')}${bpWeeklyRow('TOTAL',total,{total:true,kind})}`;
  const gapTeams=teams.map(team=>({...team,gap:team.realized.map((value,index)=>value-team.targets[index])})),gap=realized.map((value,index)=>value-targets[index]);
  bpWeekly.innerHTML=`<div class="table-scroll"><table class="bp-weekly-table"><caption>S1 a S5 seguem semanas de segunda a domingo no mês. A coluna MÊS consolida o período.${warnings.length?` Pessoas ainda não localizadas no Supabase: ${escapeHTML(warnings.join(' · '))}.`:''}</caption><thead><tr><th>${escapeHTML(new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`)))}</th>${periods.map(period=>`<th>${period.key}</th>`).join('')}<th>MÊS</th></tr></thead><tbody>${section('META',teams,targets,'targets')}${section('REALIZADO',teams,realized,'realized')}${bpWeeklyPercentRow('Atingimento',realized,targets)}${section('PAGO',teams,paid,'paid')}${section('GAP',gapTeams,gap,'gap')}${bpWeeklyPercentRow('Atingimento acumulado',realized,targets)}</tbody></table></div>`;
}
function bpFormat(value,type){return type==='rate'?bpPercent(value):type==='money'?bpMoney(value):bpNumber(value);}
function bpDiagnosis(row,planned){if(row.reason)return row.reason;if(row.plan===null)return 'Meta não cadastrada';if(row.actual===null)return 'Realizado indisponível';const gap=row.actual-planned;if(row.type==='rate'){const pp=gap*100;if(Math.abs(pp)<=2)return 'Taxa próxima da meta';return pp<0?`${Math.abs(pp).toLocaleString('pt-BR',{maximumFractionDigits:1})} p.p. abaixo da meta`:`${pp.toLocaleString('pt-BR',{maximumFractionDigits:1})} p.p. acima da meta`;}
 if(planned===0)return 'Sem meta comparável';const completion=row.actual/planned;if(completion>=.95)return `${(completion*100).toLocaleString('pt-BR',{maximumFractionDigits:0})}% do planejado até hoje`;if(completion>=.75)return `Ritmo abaixo: ${(completion*100).toLocaleString('pt-BR',{maximumFractionDigits:0})}% do planejado até hoje`;if(completion>=.5)return `Ritmo insuficiente: ${(completion*100).toLocaleString('pt-BR',{maximumFractionDigits:0})}% do planejado até hoje`;return `Distante do plano: ${(completion*100).toLocaleString('pt-BR',{maximumFractionDigits:0})}% do planejado até hoje`;}
function bpRender(){const month=bpMonthInput.value;if(!month)return;const targetDate=month===dataset.asOfDate.slice(0,7)?dataset.asOfDate:`${month}-${String(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate()).padStart(2,'0')}`;const elapsed=DashboardData.businessDayOrdinal(targetDate,dataset);const total=DashboardData.businessDaysInMonth(month,dataset);const ratio=Math.min(1,elapsed/total);const rows=bpDefinition(month).map(row=>({...row,planned:row.type==='rate'||row.fixedPlan?row.plan:row.plan===null?null:row.plan*ratio}));
 bpStatus.textContent=`Planejamento até o ${elapsed}º dia útil de ${total} (${new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(`${targetDate}T00:00:00Z`))}). Fins de semana e feriados nacionais não entram no cálculo.`;
 bpTable.innerHTML=`<div class="table-scroll"><table><caption>Meta do mês versus ritmo até o mesmo dia útil. Ligações mostra CNPJs trabalhados e, abaixo, o total de ligações. “—” indica dado ainda indisponível.</caption><thead><tr><th>Indicador</th><th>Plano mês</th><th>Planejado até hoje</th><th>Realizado</th><th>Gap</th><th>Diagnóstico</th></tr></thead><tbody>${rows.map(row=>{const comparable=row.comparisonActual??row.actual,gap=comparable===null||row.planned===null?null:comparable-row.planned;const actualHtml=row.detail?`<strong>${bpFormat(row.actual,row.type)}</strong><span class="bp-cell-detail">${escapeHTML(row.detail)}</span>`:bpFormat(row.actual,row.type);return `<tr><th scope="row">${escapeHTML(row.label)}</th><td>${bpFormat(row.plan,row.type)}</td><td>${bpFormat(row.planned,row.type)}</td><td>${actualHtml}</td><td class="${gap===null?'':gap<0?'gap-negative':'gap-positive'}">${bpGap(gap,row.type)}</td><td class="diagnosis">${escapeHTML(bpDiagnosis({...row,actual:comparable},row.planned))}</td></tr>`;}).join('')}</tbody></table></div>`;
 const first='2026-01',last=month<'2026-01'?'2026-01':month>'2026-12'?'2026-12':month,months=[];for(let cursor=first;cursor<=last;){months.push(cursor);const [year,m]=cursor.split('-').map(Number);cursor=`${m===12?year+1:year}-${String(m===12?1:m+1).padStart(2,'0')}`;}
 const historicalRows=bpDefinition(month).map(current=>({label:current.label,key:current.key,type:current.type}));
 bpHistory.innerHTML=`<div class="table-scroll"><table class="bp-history-table"><caption>Somente 2026. Em cada célula: BP / realizado. As metas só aparecem nos meses cadastrados.</caption><thead><tr><th>Indicador</th>${months.map(m=>`<th>${escapeHTML(bpMonthLabel(m))}</th>`).join('')}</tr></thead><tbody>${historicalRows.map(indicator=>`<tr><th scope="row">${escapeHTML(indicator.label)}</th>${months.map(m=>{const r=bpDefinition(m).find(item=>item.key===indicator.key),target=window.BUSINESS_PLAN.months[m]?.[indicator.key]??null;const actual=r?.detail?`${bpFormat(r.actual,indicator.type)} · ${r.detail}`:bpFormat(r?.actual??null,indicator.type);return `<td><span class="bp-cell-plan">${target===null?'Meta —':`BP ${bpFormat(target,indicator.type)}`}</span><span class="bp-cell-actual">Real. ${escapeHTML(actual)}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;bpRenderWeekly(month);}
bpMonthInput.value=dataset.asOfDate?.slice(0,7)||currentMonth;bpMonthInput.min=dataset.range?.start||bpMonthInput.value;bpMonthInput.max=dataset.range?.end||bpMonthInput.value;bpMonthInput.addEventListener('change',bpRender);bpRender();
