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
const answered=raw=>!new Set(['não atendeu','nao atendeu','não conectou','nao conectou','perdido','false','busy','failed','no answer']).has(String(raw??'').trim().toLocaleLowerCase('pt-BR'));
const dayKey=(date,memberId,role)=>`${date}|${memberId}|${role}`;

async function main(){
  const [membersRaw,tasks,meetingHunter,meetingCloser,sales,goals]=await Promise.all([
    fetchAll('team_member',{select:'id,sf_user_id,display_name,role,supervisor_id,status,is_leader,leads_role,extension',order:'display_name.asc'}),
    fetchAll('sf_task',{select:'id,owner_id,who_id,what_id,call_disposition,activity_date',subtype:'eq.Call',and:`(activity_date.gte.${start},activity_date.lte.${today})`,order:'activity_date.asc'}),
    fetchAll('fact_meeting_daily',{select:'date,hunter_id,hunter_supervisor_id,scheduled,connected',and:`(date.gte.${start},date.lte.${today})`,order:'date.asc'}),
    fetchAll('fact_closer_meeting_daily',{select:'date,closer_id,closer_supervisor_id,connected,new_meetings,follow_ups',and:`(date.gte.${start},date.lte.${today})`,order:'date.asc'}),
    fetchAll('fact_sale_daily',{select:'date,closer_id,closer_supervisor_id,deals,amount,deals_paid,amount_paid,deals_pending,amount_pending',and:`(date.gte.${start},date.lte.${today})`,order:'date.asc'}),
    fetchAll('member_goal',{select:'member_id,month_start,goal_amount,goal_connections'})
  ]);
  const members=membersRaw.filter(member=>member.role==='hunter'||member.role==='closer').map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name,role:member.role,supervisorId:member.supervisor_id,status:member.status,extension:member.extension}));
  const bySfId=new Map(members.filter(member=>member.sfUserId).map(member=>[member.sfUserId,member]));
  const leaders=membersRaw.filter(member=>member.is_leader);
  const supervisors={
    hunter:leaders.filter(member=>member.leads_role==='hunter').map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name})),
    closer:leaders.filter(member=>member.leads_role==='closer'&&/^(Matheus|Patrick)\b/i.test(member.display_name)).map(member=>({id:member.id,sfUserId:member.sf_user_id,name:member.display_name}))
  };
  const daily=new Map();
  const ensure=(date,member,role,supervisorId=member?.supervisorId)=>{
    const key=dayKey(date,member.id,role);
    if(!daily.has(key))daily.set(key,{date,month:date.slice(0,7),memberId:member.id,role,supervisorId,calledKeys:[],answeredKeys:[],calls:0,answeredCalls:0,appointments:0,connections:0,appointmentsReceived:0,soldDeals:0,soldAmount:0,paidDeals:0,paidAmount:0,pendingDeals:0,pendingAmount:0});
    return daily.get(key);
  };
  for(const task of tasks){
    const member=bySfId.get(task.owner_id);if(!member||member.role!=='hunter'||!task.activity_date)continue;
    const row=ensure(task.activity_date,member,'hunter');row.calls++;
    const isAnswered=answered(task.call_disposition);if(isAnswered)row.answeredCalls++;
    const target=task.who_id||task.what_id;if(target){const key=hash(target);if(!row.calledKeys.includes(key))row.calledKeys.push(key);if(isAnswered&&!row.answeredKeys.includes(key))row.answeredKeys.push(key);}
  }
  for(const item of meetingHunter){const member=bySfId.get(item.hunter_id);if(!member||member.role!=='hunter')continue;const row=ensure(item.date,member,'hunter');sum(row,'appointments',item.scheduled);sum(row,'connections',item.connected);}
  for(const item of meetingCloser){const member=bySfId.get(item.closer_id);if(!member||member.role!=='closer')continue;const row=ensure(item.date,member,'closer');sum(row,'appointmentsReceived',(item.new_meetings||0)+(item.follow_ups||0));sum(row,'connections',item.connected);}
  for(const item of sales){const member=bySfId.get(item.closer_id);if(!member||member.role!=='closer')continue;const row=ensure(item.date,member,'closer');sum(row,'soldDeals',item.deals);sum(row,'soldAmount',item.amount);sum(row,'paidDeals',item.deals_paid);sum(row,'paidAmount',item.amount_paid);sum(row,'pendingDeals',item.deals_pending);sum(row,'pendingAmount',item.amount_pending);}
  const output={schemaVersion:1,source:'Supabase (snapshot agregado)',extractedAt:new Date().toISOString(),asOfDate:today,range:{start:start.slice(0,7),end:today.slice(0,7)},rules:{calledCnpjs:'COUNT DISTINCT do vínculo CRM (WhoId; fallback WhatId) nas tarefas de chamada',answeredCnpjs:'Mesmo vínculo distinto, excluindo disposições de falha/não atendimento',appointmentsReceived:'Reuniões novas + follow-ups atribuídos ao closer',gapDue:'Meta mensal proporcional aos dias úteis menos valor vendido, limitado a zero'},members,supervisors,goals:goals.map(goal=>({memberId:goal.member_id,month:String(goal.month_start).slice(0,7),amount:Number(goal.goal_amount)||0,connections:Number(goal.goal_connections)||0})),dailyRows:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.memberId.localeCompare(b.memberId))};
  const target=path.join(__dirname,'supabase-data.js'),temp=`${target}.tmp`;
  fs.writeFileSync(temp,'// Snapshot agregado do Supabase. Sem credenciais ou dados pessoais de clientes.\nwindow.SUPABASE_DATA = '+JSON.stringify(output,null,2)+';\n');
  fs.renameSync(temp,target);
  console.log(JSON.stringify({status:'loaded',extractedAt:output.extractedAt,asOfDate:today,members:members.length,days:output.dailyRows.length,supervisors},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
