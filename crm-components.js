const formatMetric=(value,d)=>value===null?'—':new Intl.NumberFormat('pt-BR',d.percent?{style:'percent',maximumFractionDigits:0}:d.money?{style:'currency',currency:'BRL',maximumFractionDigits:2}:{maximumFractionDigits:0}).format(value);
const monthLabel=month=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
function formatSupabaseMetric(supabase,month,role,definition,memberIds,cutoff=null){
  const value=SupabaseData.valueFor(supabase,month,role,definition.key,memberIds,cutoff);
  if(definition.shareOfAppointments){
    const appointments=SupabaseData.valueFor(supabase,month,role,'appointmentsReceived',memberIds,cutoff);
    return value===null||appointments===null?'—':`${formatMetric(value,{})} | ${appointments>0?Math.round((value/appointments)*100):0}%`;
  }
  if(!definition.volumeKey)return formatMetric(value,definition);
  const volume=SupabaseData.valueFor(supabase,month,role,definition.volumeKey,memberIds,cutoff);
  return value===null||volume===null?'—':`${formatMetric(value,definition)} (${formatMetric(volume,{})})`;
}
class CRMMetric extends HTMLElement{
  set data({definition:d,value,previous,secondary=null,plan=null}){
    const change=DashboardData.comparison(value,previous);
    const note=value===null?'Indisponível neste período':change===null?'Sem base comparável':`${change>0?'+':''}${change.toLocaleString('pt-BR',{maximumFractionDigits:1})}% vs. mês anterior`;
    const secondaryHtml=secondary?`<p class="metric-secondary"><strong>${escapeHTML(secondary.value)}</strong> ${escapeHTML(secondary.label)}</p>`:'';
    const planHtml=plan?`<dl class="metric-plan"><div><dt>Realizado</dt><dd>${escapeHTML(plan.actual)}</dd></div><div><dt>BP MTD</dt><dd>${escapeHTML(plan.planned)}</dd></div><div><dt>Gap</dt><dd class="${plan.negative?'negative':''}">${escapeHTML(plan.gap)}</dd></div><div><dt>Ating.</dt><dd>${escapeHTML(plan.attainment)}</dd></div></dl>`:'';
    this.innerHTML=`<article class="metric ${d.key==='revenue'?'featured':''}" style="${toneStyle(d.tone)}"><div class="metric-heading"><span class="metric-icon">${iconMarkup(d.icon)}</span><span class="metric-label">${escapeHTML(d.label)}</span></div><div class="metric-value ${d.money?'long':''}">${escapeHTML(formatMetric(value,d))}</div>${secondaryHtml}<p class="metric-note">${escapeHTML(note)}${d.note?`<br>${escapeHTML(d.note)}`:''}</p>${planHtml}</article>`;
  }
}
customElements.define('crm-metric',CRMMetric);
class CRMTeam extends HTMLElement{
  set data({supabase,month}){
    const defs=SupabaseData.definitions.hunter,cutoff=month===supabase.asOfDate?.slice(0,7)?supabase.asOfDate:null;
    const hiddenSupervisorIds=new Set(['eacebc5a-b84a-4cff-848a-20a57d118784',...(supabase.supervisors?.hunter||[]).filter(supervisor=>/^Thais Leite$/i.test(supervisor.name)).map(supervisor=>supervisor.id)]);
    const matheusId=(supabase.supervisors?.hunter||[]).find(supervisor=>/^Matheus Porto$/i.test(supervisor.name))?.id;
    const supervisors=(supabase.supervisors?.hunter||[]).filter(supervisor=>!hiddenSupervisorIds.has(supervisor.id)&&supervisor.id!==matheusId);
    const prospectingCloserId='prospeccao-closer';
    const knownSupervisorIds=new Set((supabase.supervisors?.hunter||[]).map(supervisor=>supervisor.id));
    const prospectingMembers=supabase.members.filter(member=>member.role==='hunter'&&!hiddenSupervisorIds.has(member.supervisorId)&&(member.supervisorId===prospectingCloserId||member.supervisorId===matheusId||!member.supervisorId||(!knownSupervisorIds.has(member.supervisorId)&&member.supervisorId!=='unassigned-hunter')));
    if(prospectingMembers.length||supabase.members.some(member=>member.role==='hunter'&&member.supervisorId==='unassigned-hunter'))supervisors.push({id:prospectingCloserId,name:'Prospecção Closer'});
    const memberIds=id=>id===prospectingCloserId?prospectingMembers.concat(supabase.members.filter(member=>member.role==='hunter'&&member.supervisorId==='unassigned-hunter')).map(member=>member.id):supabase.members.filter(member=>member.role==='hunter'&&member.supervisorId===id).map(member=>member.id);
    const cells=ids=>defs.map(definition=>`<td>${escapeHTML(formatSupabaseMetric(supabase,month,'hunter',definition,ids,cutoff))}</td>`).join('');
    const totalIds=supervisors.flatMap(supervisor=>memberIds(supervisor.id));
    this.innerHTML=`<div class="table-scroll" role="region" aria-label="Indicadores por Supervisor de Hunter" tabindex="0"><table><caption>Consolidado por time, com os mesmos indicadores individuais exibidos na página Performance.</caption><thead><tr><th scope="col">Supervisor de Hunter</th>${defs.map(definition=>`<th scope="col">${escapeHTML(definition.label)}</th>`).join('')}</tr></thead><tbody>${supervisors.map(supervisor=>`<tr><th scope="row">${escapeHTML(supervisor.name)}</th>${cells(memberIds(supervisor.id))}</tr>`).join('')||`<tr><td colspan="${defs.length+1}" class="empty-state">Os times aparecerão após a conexão das fontes.</td></tr>`}</tbody><tfoot><tr><th scope="row">Total</th>${cells(totalIds)}</tr></tfoot></table></div>`;
  }
}
customElements.define('crm-team',CRMTeam);
class CRMCloserTeam extends HTMLElement{
  set data({supabase,month}){
    const defs=SupabaseData.definitions.closer;
    const cutoff=month===supabase.asOfDate?.slice(0,7)?supabase.asOfDate:null;
    const supervisors=supabase.supervisors?.closer||[];
    const memberIds=id=>SupabaseData.membersFor(supabase,'closer',{supervisorId:id}).map(member=>member.id);
    const cells=ids=>defs.map(definition=>`<td>${escapeHTML(formatSupabaseMetric(supabase,month,'closer',definition,ids,cutoff))}</td>`).join('');
    const totalIds=supervisors.flatMap(supervisor=>memberIds(supervisor.id));
    this.innerHTML=`<div class="table-scroll" role="region" aria-label="Indicadores por Supervisor de Closer" tabindex="0"><table><caption>Consolidado por time, com os mesmos indicadores individuais exibidos na página Performance.</caption><thead><tr><th scope="col">Supervisor de Closer</th>${defs.map(definition=>`<th scope="col">${escapeHTML(definition.label)}</th>`).join('')}</tr></thead><tbody>${supervisors.map(supervisor=>`<tr><th scope="row">${escapeHTML(supervisor.name)}</th>${cells(memberIds(supervisor.id))}</tr>`).join('')||`<tr><td colspan="${defs.length+1}" class="empty-state">Snapshot do Supabase ainda não carregado.</td></tr>`}</tbody><tfoot><tr><th scope="row">Total</th>${cells(totalIds)}</tr></tfoot></table></div>`;
  }
}
customElements.define('crm-closer-team',CRMCloserTeam);
class MonthlyHistory extends HTMLElement{
  set data({definition:d,points,periodLabel='',comparable=false,conversion=null}){
    const available=points.filter(p=>p.value!==null),current=points.at(-1)?.value??null;
    const compact=v=>new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(v);
    const high=Math.max(1,...available.map(p=>p.value)),low=Math.min(0,...available.map(p=>p.value));
    const x=i=>26+i*144/Math.max(1,points.length-1),y=v=>76-(v-low)/(high-low)*62;
    const segments=[];let segment=[];
    points.forEach((p,i)=>{if(p.value===null){if(segment.length)segments.push(segment);segment=[];}else segment.push({x:x(i),y:y(p.value),...p});});if(segment.length)segments.push(segment);
    const graph=available.length?`<svg class="sparkline" viewBox="0 0 178 104" role="img" aria-label="${escapeHTML(d.label)} por mês. Valores na tabela abaixo.">${[0,.5,1].map(r=>`<path d="M26 ${76-r*62}H170" stroke="#e5edfa"/><text x="0" y="${79-r*62}">${escapeHTML(compact(low+(high-low)*r))}</text>`).join('')}${segments.map(part=>`<polygon class="chart-area" points="${part[0].x},76 ${part.map(p=>`${p.x},${p.y}`).join(' ')} ${part.at(-1).x},76" fill="var(--accent)" opacity=".12"/><polyline points="${part.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"/>${part.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2" fill="var(--accent)"><title>${escapeHTML(monthLabel(p.month))}: ${escapeHTML(formatMetric(p.value,d))}</title></circle>`).join('')}`).join('')}${points.filter((_,i)=>i===0||i===Math.floor(points.length/2)||i===points.length-1).map(p=>`<text x="${x(points.indexOf(p))}" y="97" text-anchor="middle">${escapeHTML(monthLabel(p.month))}</text>`).join('')}</svg>`:'<div class="chart-empty">Histórico mensal indisponível</div>';
    const change=comparable&&d.key!=='pipeline'?DashboardData.comparison(current,points.at(-2)?.value??null):null;
    this.innerHTML=`<article class="history-card" style="${toneStyle(d.tone)}"><div class="metric-heading"><span class="metric-icon">${iconMarkup(d.icon)}</span><span class="metric-label">${escapeHTML(d.label)}</span></div>${conversion?`<span class="history-conversion">${escapeHTML(conversion)}</span>`:''}<div class="history-value">${escapeHTML(formatMetric(current,d))}</div><p class="metric-note">${escapeHTML(periodLabel)}</p>${change===null?'':`<p class="history-change ${change<0?'negative':''}">${change>0?'+':''}${change.toLocaleString('pt-BR',{maximumFractionDigits:1})}% vs. mesmo recorte anterior</p>`}${d.note?`<p class="metric-note">${escapeHTML(d.note)}</p>`:''}${graph}<details><summary>Valores mensais</summary><table><thead><tr><th scope="col">Mês</th><th scope="col">Valor</th></tr></thead><tbody>${points.map(p=>`<tr><th scope="row">${escapeHTML(monthLabel(p.month))}</th><td>${escapeHTML(formatMetric(p.value,d))}</td></tr>`).join('')}</tbody></table></details></article>`;
  }
}
customElements.define('monthly-history',MonthlyHistory);
