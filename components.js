/* Native custom elements, with light DOM so styles and semantics stay accessible. */
const icons = {
  home:'<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
  users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  activity:'<path d="m4 18 5-9 6 5 5-10M15 4h5v5"/><circle cx="4" cy="18" r="2"/><circle cx="9" cy="9" r="2"/><circle cx="15" cy="14" r="2"/>',
  trend:'<path d="m3 18 6-7 5 4 7-11m-6 0h6v6"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 2v6m8-6v6M4 11h16"/>',
  phone:'<path d="m6 3 3 5-2 2a14 14 0 0 0 7 7l2-2 5 3-1 3C10 24 0 13 3 4zM15 3a7 7 0 0 1 6 6m-7-2a3 3 0 0 1 3 3"/>',
  answered:'<path d="m6 3 3 5-2 2a14 14 0 0 0 7 7l2-2 5 3-1 3C10 24 0 13 3 4zM14 7l3 3 5-6"/>',
  link:'<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(1 -1) scale(.9)"/>',
  cart:'<path d="M2 3h3l3 12h11l3-9H6M9 19h.01M18 19h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  money:'<path d="M12 2v20m5-15c-1-4-11-4-10 2 1 4 10 1 10 6 0 5-10 5-11 1"/>',
  ticket:'<text x="1" y="18" fill="currentColor" stroke="none" font-size="17" font-weight="700">R$</text>',
  layers:'<path d="m3 7 9-4 9 4-9 4zm0 5 9 4 9-4M3 17l9 4 9-4"/>',
  chart:'<path d="M4 20V10m6 10V4m6 16v-7"/>',
  book:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5zM4 4.5v18M8 6h8"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.1h-3v-.1a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.04 15 1.7 1.7 0 0 0 5.5 14H5.4v-3h.1A1.7 1.7 0 0 0 7.04 9.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.72 4.8v-.1h3v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.94 11h.1v3h-.1A1.7 1.7 0 0 0 19.4 15z"/>',
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const brNumber = value => new Intl.NumberFormat('pt-BR').format(value);
const brMoney = value => `R$ ${brNumber(value)}`;
const iconMarkup = name => `<ui-icon name="${escapeHTML(name)}"></ui-icon>`;
class UIIcon extends HTMLElement {
  connectedCallback(){this.setAttribute('aria-hidden','true');this.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[this.getAttribute('name')] || icons.trend}</svg>`;}
}
customElements.define('ui-icon',UIIcon);
class DashboardSidebar extends HTMLElement {
  connectedCallback(){const item=(target,label,icon,extra='')=>`<a class="nav-link ${extra}" href="#${target}" data-view-link="${target}">${iconMarkup(icon)}<span>${label}</span></a>`;this.innerHTML=`<a class="brand" href="#dashboard" data-view-link="dashboard">Ideal Trends</a><nav class="sidebar-nav" aria-label="Navegação principal"><p class="nav-group">Resultados</p>${item('dashboard','Dashboards','home','active')}${item('performance','Performance','chart')}${item('business-plan','Business Plan','activity')}${item('insights','Insights','trend')}<p class="nav-group">Conhecimento</p>${item('knowledge','Playbook','book')}${item('knowledge','Produtos','layers')}${item('knowledge','Mercado','trend')}${item('knowledge','FAQ','activity')}${item('knowledge','Templates','book')}${item('knowledge','Onboarding','users')}${item('knowledge','TIME','users','nested-title')}${item('knowledge','Organograma','users','nested')}${item('knowledge','LINKS','link','nested-title')}${item('knowledge','Salesforce','link','nested')}${item('knowledge','Discador','phone','nested')}${item('knowledge','Ferramentas','gear','nested')}<p class="nav-group">Operação</p>${item('operation','Políticas','book')}${item('operation','Processos','gear')}${item('operation','Rituais','calendar')}</nav><svg class="sidebar-wave" viewBox="0 0 190 190" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 37C60 36 67 182 211 150" fill="none" stroke="#112c55" stroke-width="38"/><path d="M-10 104C95 26 97 170 215 143" fill="none" stroke="#102645" stroke-width="35"/></svg>`;}
}
customElements.define('dashboard-sidebar',DashboardSidebar);
class MetricCard extends HTMLElement {
  static get observedAttributes(){return ['label','value','change','icon','tone','featured','conversion'];}
  connectedCallback(){this.render();}
  attributeChangedCallback(){if(this.isConnected)this.render();}
  render(){const get=name=>escapeHTML(this.getAttribute(name));const featured=this.hasAttribute('featured');const conversion=this.getAttribute('conversion');this.innerHTML=`<article class="metric ${featured?'featured':''}" style="${toneStyle(this.getAttribute('tone'))}"><div class="metric-heading"><span class="metric-icon">${iconMarkup(this.getAttribute('icon'))}</span><span class="metric-label">${get('label')}</span></div><div class="metric-value ${String(this.getAttribute('value')).length>11?'long':''}">${get('value')}</div>${conversion?`<div class="conversion-row"><div><strong>${escapeHTML(conversion)}</strong><small>conversão<br>(feitas → atendidas)</small></div><span class="badge">+${get('change')}</span></div>`:`<div class="delta">↑ ${get('change')} <small>vs. período anterior</small></div>`}</article>`;}
}
const tones={blue:['#0768ff','#e6f0ff'],purple:['#792cff','#eee6ff'],orange:['#ff8500','#fff1de'],green:['#00a68e','#dff6ef'],slate:['#385985','#e9edf4'],pink:['#ff3fa0','#ffe9f5']};
function toneStyle(tone){const [accent,tint]=tones[tone]||tones.blue;return `--accent:${accent};--tint:${tint}`;}
customElements.define('metric-card',MetricCard);
class TeamPerformance extends HTMLElement {
  set data(value){this._data=value;this.render();}
  render(){if(!this._data)return;const {rows,total}=this._data;const headings=[['money','Receita (R$)','green'],['phone','Ligações<br>efetuadas','blue'],['answered','Ligações<br>atendidas','blue'],[null,'Conversão<br><small>(feitas → atendidas)<br>vs. esperado</small>'],['calendar','Agendamentos','blue'],['link','Conexões','purple'],['cart','Vendas','orange'],['ticket','TM (R$)','green'],['layers','Pipeline (R$)','slate']];const cells=row=>`<td><strong>${brMoney(row.revenue)}</strong><div class="cell-delta">↑ ${escapeHTML(row.growth)}</div></td><td>${brNumber(row.calls)}</td><td>${brNumber(row.answered)}</td><td><div class="conversion-cell">${escapeHTML(row.conversion)}<span class="badge ${row.warning?'warning':''}">+${escapeHTML(row.expected)}</span></div></td><td>${brNumber(row.appointments)}</td><td>${brNumber(row.connections)}</td><td>${brNumber(row.sales)}</td><td>${brMoney(row.ticket)}<div class="cell-delta">↑ ${escapeHTML(row.ticketGrowth)}</div></td><td>${brMoney(row.pipeline)}<div class="cell-delta">↑ ${escapeHTML(row.pipelineGrowth)}</div></td>`;this.innerHTML=`<div class="table-scroll" role="region" aria-label="Desempenho comercial por time, tabela com rolagem horizontal" tabindex="0"><table><caption>Valores transcritos da imagem; totais preservados conforme a referência e podem divergir da soma dos times.</caption><thead><tr><th scope="col">Time</th>${headings.map(([icon,label,tone])=>`<th scope="col"><div class="table-heading">${icon?`<span class="metric-icon" style="${toneStyle(tone)}">${iconMarkup(icon)}</span>`:''}<span>${label}</span></div></th>`).join('')}</tr></thead><tbody>${rows.map((row,index)=>`<tr><th scope="row"><span class="team-name"><i class="team-dot" style="--dot:${['#3679ff','#932aff','#ff9400','#00af97','#ff68ad'][index%5]}"></i>${escapeHTML(row.name)}</span></th>${cells(row)}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th>${cells(total)}</tr></tfoot></table></div>`;}
}
customElements.define('team-performance',TeamPerformance);
let chartId=0;
class HistoryCard extends HTMLElement {
  set data(value){this._data=value;this.render();}
  render(){if(!this._data)return;const d=this._data;const id=`chart-fill-${++chartId}`;const color=(tones[d.tone]||tones.blue)[0];const points=d.series.map((v,i)=>`${26+i*144/(d.series.length-1)},${75-v*58}`).join(' ');this.innerHTML=`<article class="history-card" style="${toneStyle(d.tone)}"><div class="metric-heading"><span class="metric-icon">${iconMarkup(d.icon)}</span><span class="metric-label">${escapeHTML(d.label)}</span></div><div class="history-value">${escapeHTML(d.value)}</div><div class="delta">↑ ${escapeHTML(d.historyChange||d.change)} <small>vs. período anterior</small></div><svg class="sparkline" viewBox="0 0 178 100" role="img" aria-label="${escapeHTML(d.label)}: evolução ilustrativa, sem valores diários reais"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".24"/><stop offset="100%" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>${[10,32,54,76].map((y,i)=>`<path d="M26 ${y}H170" stroke="#e5edfa" stroke-width=".7"/><text x="0" y="${y+3}">${escapeHTML(d.axis[i])}</text>`).join('')}<path d="M26 10V76H170V10" fill="none" stroke="#e5edfa" stroke-width=".7"/><polygon class="chart-area" points="26,76 ${points} 170,76" fill="url(#${id})"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>${['01/09','08/09','15/09','22/09','30/09'].map((label,i)=>`<text x="${26+i*36}" y="94" text-anchor="middle">${label}</text>`).join('')}</svg></article>`;}
}
customElements.define('history-card',HistoryCard);
