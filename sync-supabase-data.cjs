const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const base=(process.env.SUPABASE_URL||'https://emnsdeynavfdjlmqfszw.supabase.co').replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw Error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente. A chave nunca é gravada no snapshot.');
const today=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
// Mantém pelo menos 12 meses para que os históricos mensal e diário não percam
// os últimos meses do ano anterior ao virar janeiro.
const start=process.env.DASHBOARD_START_DATE||`${Number(today.slice(0,4))-1}-01-01`;
const headers={apikey:key,Authorization:`Bearer ${key}`};

async function fetchAll(table,params={}){
  const size=1000,rows=[];
  for(let from=0;;from+=size){
    const url=new URL(`${base}/rest/v1/${table}`);
    for(const [name,value] of Object.entries(params))for(const item of (Array.isArray(value)?value:[value]))url.searchParams.append(name,item);
    const response=await fetch(url,{headers:{...headers,Range:`${from}-${from+size-1}`}});
    if(!response.ok)throw Error(`${table}: ${response.status} ${await response.text()}`);
    const page=await response.json();rows.push(...page);if(page.length<size)break;
  }
  return rows;
}
const sum=(target,key,value)=>{target[key]=(target[key]||0)+(Number(value)||0);};
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,16);
const dayKey=(date,memberId,role)=>`${date}|${memberId}|${role}`;
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const currentMonthEnd=`${today.slice(0,7)}-${String(new Date(Date.UTC(+today.slice(0,4),+today.slice(5,7),0)).getUTCDate()).padStart(2,'0')}`;
const answeredByDisposition=value=>!new Set(['não atendeu','nao atendeu','não conectou','nao conectou','perdido','false','busy','failed','no answer']).has(normalized(value));

async function main(){
  const [membersRaw,tasks,pabxDailyCalls,meetingHunter,meetingCloser,opportunities,goals]=await Promise.all([
    fetchAll('team_member',{select:'id,sf_user_id,display_name,role,supervisor_id,status,is_leader,leads_role,extension',order:'display_name.asc'}),
    fetchAll('sf_task',{select:'id,owner_id,who_id,what_id,call_duration_seconds,call_disposition,activity_date',subtype:'eq.Call',and:`(activity_date.gte.${start},activity_date.lte.${today})`,order:'activity_date.asc'}),
    fetchAll('pabx_daily_call',{select:'day,team_member_id,total_calls,answered',and:`(day.gte.${start},day.lte.${today})`,order:'day.asc'}),
    fetchAll('fact_meeting_daily',{select:'date,hunter_id,hunter_supervisor_id,scheduled,connected',and:`(date.gte.${start},date.lte.${today})`,order:'date.asc'}),
    fetchAll('fact_closer_meeting_daily',{select:'date,closer_id,closer_supervisor_id,connected,new_meetings,follow_ups',and:`(date.gte.${start},date.lte.${today})`,order:'date.asc'}),
    fetchAll('sf_opportunity',{select:'id,hunter_id,hunter_supervisor_id,closer_id,scheduled_date,meeting_outcome,cancellation_reason,stage_name,won_at,paid_at,amount',or:`(scheduled_date.gte.${start},won_at.gte.${start},paid_at.gte.${start})`,order:'scheduled_date.asc'}),
    fetchAll('member_goal',{select:'member_id,month_start,goal_amount,goal_connections'})
  ]);
  const members=membersRaw.filter(member=>member.role==='hunter'||member.role==='closer').map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name,role:member.role,supervisorId:member.supervisor_id,status:member.status,extension:member.extension}));
  const byId=new Map(members.map(member=>[member.id,member]));
  // A pessoa pode ter mais de um cadastro histórico no PABX. Para a visão
  // histórica de Hunter, toda a atividade vai para o cadastro ativo da mesma
  // pessoa; o supervisor atual serve somente para organizar o time exibido.
  const currentHunterBySfId=new Map();
  for(const member of members){
    if(member.role!=='hunter'||!member.sfUserId)continue;
    const current=currentHunterBySfId.get(member.sfUserId);
    if(!current||member.status==='active'&&current.status!=='active')currentHunterBySfId.set(member.sfUserId,member);
  }
  const bySfId=new Map(members.filter(member=>member.sfUserId).map(member=>[member.sfUserId,member]));
  const leaders=membersRaw.filter(member=>member.is_leader);
  const supervisors={
    // Thais não integra mais a visão de supervisão de Hunter.
    hunter:leaders.filter(member=>member.leads_role==='hunter'&&!/^Thais Leite$/i.test(member.display_name)).map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name})),
    closer:leaders.filter(member=>member.leads_role==='closer'&&/^(Matheus|Patrick)\b/i.test(member.display_name)).map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name}))
  };
  const hunterSupervisorBySfId=new Map(supervisors.hunter.filter(supervisor=>supervisor.sfUserId).map(supervisor=>[supervisor.sfUserId,supervisor.id]));
  const leaderBySfId=new Map(leaders.filter(leader=>leader.sf_user_id).map(leader=>[leader.sf_user_id,leader]));
  const prospectingCloserSupervisor={id:'prospeccao-closer',sfUserId:null,name:'Prospecção Closer'};
  // A mesma pessoa pode ter passado por mais de uma supervisão. A chave
  // também inclui o supervisor histórico para não misturar períodos/times.
  const historicalHunterByKey=new Map();
  const historicalHunter=(sfUserId,supervisorSfId)=>{
    const leader=leaderBySfId.get(supervisorSfId);
    // Vendas históricas de Hunter ligadas a uma liderança que hoje é de
    // Closer são consolidadas na origem correta, sem exibir o Closer como
    // supervisor de Hunter.
    const isCloserLeader=leader?.leads_role==='closer';
    if(isCloserLeader&&!supervisors.hunter.some(supervisor=>supervisor.id===prospectingCloserSupervisor.id))supervisors.hunter.push(prospectingCloserSupervisor);
    const supervisorId=hunterSupervisorBySfId.get(supervisorSfId)||(isCloserLeader?prospectingCloserSupervisor.id:null);if(!sfUserId||!supervisorId)return null;
    const historicalKey=`${sfUserId}|${supervisorId}`;
    if(historicalHunterByKey.has(historicalKey))return historicalHunterByKey.get(historicalKey);
    const known=membersRaw.find(member=>member.sf_user_id===sfUserId),member={id:`historical-hunter-${sfUserId}`,sfUserId,name:`${known?.display_name||'Colaborador'} (histórico)`,role:'hunter',supervisorId,status:'historical',extension:null};
    // O id precisa representar a combinação pessoa/time; assim as linhas
    // históricas de uma transferência não se fundem com o time atual.
    member.id=`historical-hunter-${sfUserId}-${supervisorId}`;
    members.push(member);historicalHunterByKey.set(historicalKey,member);return member;
  };
  const daily=new Map();
  const ensure=(date,member,role,supervisorId=member?.supervisorId)=>{
    const key=dayKey(date,member.id,role);
    if(!daily.has(key))daily.set(key,{date,month:date.slice(0,7),memberId:member.id,role,supervisorId,calledKeys:[],answeredKeys:[],calls:0,answeredCalls:0,appointments:0,connections:0,noShows:0,futureMeetings:0,appointmentsReceived:0,soldDeals:0,soldAmount:0,paidDeals:0,paidAmount:0,pendingDeals:0,pendingAmount:0});
    return daily.get(key);
  };
  for(const task of tasks){
    const member=bySfId.get(task.owner_id),rawDuration=task.call_duration_seconds,hasDuration=rawDuration!==null&&rawDuration!==undefined,duration=Number(rawDuration);if(!member||member.role!=='hunter'||!task.activity_date||(hasDuration&&(!Number.isFinite(duration)||duration<0)))continue;
    const row=ensure(task.activity_date,member,'hunter');
    // A duração é a regra oficial. A sincronização atual do CRM tem tarefas
    // antigas sem esse campo; nelas, preservamos o resultado registrado para
    // não apagar vínculos de CNPJ enquanto a carga histórica é completada.
    const isAnswered=hasDuration?duration!==0:answeredByDisposition(task.call_disposition);
    const target=task.who_id||task.what_id;if(target){const key=hash(target);if(!row.calledKeys.includes(key))row.calledKeys.push(key);if(isAnswered&&!row.answeredKeys.includes(key))row.answeredKeys.push(key);}
  }
  // O PABX é a fonte completa de discagens. `total_calls` representa todas
  // as ligações efetuadas e `answered` as chamadas atendidas (duração > 0).
  // As tarefas do CRM seguem somente para identificar CNPJs únicos.
  for(const item of pabxDailyCalls){
    const sourceMember=byId.get(item.team_member_id);
    const member=sourceMember?.sfUserId?(currentHunterBySfId.get(sourceMember.sfUserId)||sourceMember):sourceMember;
    if(!member||member.role!=='hunter'||!item.day)continue;
    const calls=Number(item.total_calls),answered=Number(item.answered);if(!Number.isFinite(calls)||calls<0||!Number.isFinite(answered)||answered<0)continue;
    const row=ensure(item.day,member,'hunter');sum(row,'calls',calls);sum(row,'answeredCalls',answered);
  }
  for(const item of meetingHunter){
    const assigned=bySfId.get(item.hunter_id);
    // Para as análises históricas, o resultado individual acompanha a pessoa
    // e o seu líder atual no Salesforce. A supervisão que existia no dia do
    // evento não cria uma segunda linha nem esconde o histórico do time atual.
    const member=assigned?.role==='hunter'?assigned:historicalHunter(item.hunter_id,item.hunter_supervisor_id);
    if(!member)continue;
    const row=ensure(item.date,member,'hunter');sum(row,'appointments',item.scheduled);sum(row,'connections',item.connected);
  }
  for(const item of meetingCloser){const member=bySfId.get(item.closer_id);if(!member||member.role!=='closer')continue;const row=ensure(item.date,member,'closer');sum(row,'appointmentsReceived',(item.new_meetings||0)+(item.follow_ups||0));sum(row,'connections',item.connected);}
  for(const item of opportunities){
    const assignedHunter=bySfId.get(item.hunter_id),closer=bySfId.get(item.closer_id),amount=Number(item.amount)||0,wonDate=isoDate(item.won_at),paidDate=isoDate(item.paid_at),scheduledDate=isoDate(item.scheduled_date),stage=normalized(item.stage_name);
    const isSold=stage==='fechado ganho'||stage==='aguardando pagamento',isPaid=stage==='fechado ganho',isPending=stage==='aguardando pagamento';
    // Vendas entram no mês em que a oportunidade foi marcada como Ganho.
    // Pagamentos continuam, intencionalmente, na respectiva data de pagamento.
    const soldDate=wonDate;
    const hunter=isSold?(assignedHunter?.role==='hunter'?assignedHunter:historicalHunter(item.hunter_id,item.hunter_supervisor_id)):null;
    for(const [member,role] of [[hunter,'hunter'],[closer,'closer']]){
      if(!member||member.role!==role)continue;
      if(isSold&&soldDate&&soldDate>=start&&soldDate<=today){const row=ensure(soldDate,member,role);sum(row,'soldDeals',1);sum(row,'soldAmount',amount);if(isPending){sum(row,'pendingDeals',1);sum(row,'pendingAmount',amount);}}
      if(isPaid&&paidDate&&paidDate>=start&&paidDate<=today){const row=ensure(paidDate,member,role);sum(row,'paidDeals',1);sum(row,'paidAmount',amount);}
    }
    if(closer?.role!=='closer'||!scheduledDate||scheduledDate<start||scheduledDate>currentMonthEnd)continue;
    const outcome=normalized(item.meeting_outcome),reason=normalized(item.cancellation_reason);
    if(scheduledDate<=today&&outcome==='cancelada'&&reason==='nao compareceu')sum(ensure(scheduledDate,closer,'closer'),'noShows',1);
    if(scheduledDate>today&&!outcome)sum(ensure(scheduledDate,closer,'closer'),'futureMeetings',1);
  }
  const output={schemaVersion:1,source:'Supabase (snapshot agregado)',extractedAt:new Date().toISOString(),asOfDate:today,range:{start:start.slice(0,7),end:today.slice(0,7)},rules:{calledCnpjs:'COUNT DISTINCT do vínculo CRM (WhoId; fallback WhatId) nas tarefas de chamada com duração maior ou igual a zero',answeredCnpjs:'Mesmo vínculo distinto nas chamadas com duração diferente de zero; usa o resultado registrado apenas em tarefas históricas sem duração',calls:'PABX: total de discagens registradas em total_calls',answeredCalls:'PABX: discagens atendidas, com duração maior que zero, registradas em answered',sales:'Fechado Ganho ou Aguardando pagamento, pela data em que a oportunidade foi marcada como Ganho. Pago somente em Fechado Ganho, por data de pagamento',appointmentsReceived:'Agendamentos recebidos e conexões por data da reunião',meetingResults:'No-show por data da reunião cancelada como “Não compareceu”; futuras por agendamento posterior à data da carga sem resultado',gapDue:'Meta mensal proporcional aos dias úteis menos valor vendido, limitado a zero'},members,supervisors,goals:goals.map(goal=>({memberId:goal.member_id,month:String(goal.month_start).slice(0,7),amount:Number(goal.goal_amount)||0,connections:Number(goal.goal_connections)||0})),dailyRows:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.memberId.localeCompare(b.memberId))};
  const target=path.join(__dirname,'supabase-data.js'),temp=`${target}.tmp`;
  fs.writeFileSync(temp,'// Snapshot agregado do Supabase. Sem credenciais ou dados pessoais de clientes.\nwindow.SUPABASE_DATA = '+JSON.stringify(output,null,2)+';\n');
  fs.renameSync(temp,target);
  console.log(JSON.stringify({status:'loaded',extractedAt:output.extractedAt,asOfDate:today,members:members.length,days:output.dailyRows.length,supervisors},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
