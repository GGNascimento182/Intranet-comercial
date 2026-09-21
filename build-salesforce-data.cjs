const fs=require('node:fs');
const path=require('node:path');
const {validate,valueFor}=require('./data-model.js');
function buildCloserSales(batches){
  const rows=new Map();
  for(const batch of batches){
    if(!['sales','totalSales'].includes(batch.metric))throw Error('Métrica de closer inválida.');
    for(const record of (batch.records||[])){
      const date=record[batch.dateField],closerName=record.closerName||'Sem closer',supervisorName=record.closerSupervisorName||'Sem supervisor';
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(record.n)||record.n<0||!Number.isFinite(record.amount??0))throw Error('Agregado diário de closer inválido.');
      const key=JSON.stringify([date,closerName,supervisorName]);
      if(!rows.has(key))rows.set(key,{date,month:date.slice(0,7),closerName,supervisorName,sales:0,salesAmount:0,paidSales:0,paidAmount:0});
      const row=rows.get(key),amount=record.amount??0;
      if(batch.metric==='totalSales'){row.sales=record.n;row.salesAmount=amount;}
      else {row.paidSales=record.n;row.paidAmount=amount;}
    }
  }
  return [...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.closerName.localeCompare(b.closerName,'pt-BR'));
}
function build(payload){
  const rows=new Map(),coverage=[],audits=[],warnings=[];
  const supervisors=new Map((payload.supervisors||[]).map(s=>[s.id,s.name]));
  if(supervisors.size!==5)throw Error('São necessários os cinco supervisores configurados.');
  supervisors.set('DISCONNECTED','Desligados');
  const expected=[];
  for(let year=payload.startYear;year<=payload.endYear;year++)for(const metric of ['appointments','connections','sales','totalSales','pipeline']){
    if(year<=Number(payload.today.slice(0,4))||metric==='pipeline')expected.push(`${year}:${metric}`);
  }
  const actual=payload.batches.map(b=>`${b.year}:${b.metric}`);
  if(actual.length!==new Set(actual).size||expected.length!==actual.length||expected.some(k=>!actual.includes(k)))throw Error('Conjunto de consultas incompleto ou duplicado.');
  const currentMonth=payload.today.slice(0,7);
  const ensure=(date,id)=>{
    const key=JSON.stringify([date,id]);
    if(!rows.has(key))rows.set(key,{date,month:date.slice(0,7),supervisorId:id,supervisorName:supervisors.get(id),revenue:0,appointments:0,connections:0,sales:0,totalSales:0,totalRevenue:0,pipeline:0});
    return rows.get(key);
  };
  for(const batch of payload.batches){
    const seen=new Set();let count=0,missing=0,amount=0;
    for(const record of (Array.isArray(batch.records)?batch.records:batch.records?[batch.records]:[])){
      const date=record[batch.dateField];
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number(date.slice(0,4))!==batch.year||!Number.isInteger(record.n)||record.n<0)throw Error('Agregado inválido.');
      if(batch.metric!=='pipeline'&&date>payload.today)throw Error('Evento realizado com data futura.');
      const id=record.HunterSupervisor__c??null;
      if(!supervisors.has(id))throw Error('Consulta retornou supervisor fora do recorte autorizado.');
      const key=JSON.stringify([date,id]);if(seen.has(key))throw Error('Grupo duplicado na consulta.');seen.add(key);
      const row=ensure(date,id);
      count+=record.n;
      if(batch.metric==='sales'||batch.metric==='totalSales'||batch.metric==='pipeline'){
        if(!Number.isInteger(record.valued)||record.valued<0||record.valued>record.n)throw Error('Contagem de valores inválida.');
        const absent=record.n-record.valued;missing+=absent;
        const total=record.amount??0;
        if(!Number.isFinite(total))throw Error('Soma monetária inválida.');
        if(record.valued>0&&record.amount===null)throw Error('Soma monetária ausente.');
        amount+=total;
        // SUM(Amount) do Salesforce ignora valores vazios. Mantemos esse total
        // para que a receita e o pipeline reflitam a soma do campo Amount,
        // registrando a ressalva de qualidade sem esconder o indicador.
        if(batch.metric==='sales'){row.revenue=total;row.sales=record.n;}
        else if(batch.metric==='totalSales'){row.totalRevenue=total;row.totalSales=record.n;}
        else row.pipeline=total;
      }else row[batch.metric]=record.n;
    }
    for(let m=1;m<=12;m++){
      const month=`${batch.year}-${String(m).padStart(2,'0')}`;
      if(batch.metric!=='pipeline'&&month>currentMonth)continue;
      const rawFirst=payload.firstDates?.[batch.metric];
      const first=(Array.isArray(rawFirst)?rawFirst[0]:rawFirst)?.slice(0,7);
      const metrics=batch.metric==='sales'?['sales','revenue']:batch.metric==='totalSales'?['totalSales','totalRevenue']:[batch.metric];
      for(const metric of metrics)coverage.push({month,metric,complete:!payload.firstDates||(!!first&&month>=first),partialPeriod:month===currentMonth&&metric!=='pipeline'});
    }
    audits.push({year:batch.year,metric:batch.metric,records:count,knownAmount:amount,missingAmounts:missing});
    if(missing)warnings.push(`${batch.year}: ${missing} oportunidades de ${batch.metric==='pipeline'?'pipeline':'venda'} sem Amount; a soma considera esses registros como zero.`);
  }
  if(payload.connectedWithoutDate)warnings.push(`${payload.connectedWithoutDate} oportunidades marcadas como Conectada estão sem data da reunião na base acessível e não podem ser alocadas em meses.`);
  if(payload.invalidMeetingDates)warnings.push(`${payload.invalidMeetingDates} reuniões com a data inconsistente 30/12/1899 foram excluídas do histórico.`);
  const monthly=new Map();
  for(const day of rows.values()){
    const key=JSON.stringify([day.month,day.supervisorId]);
    if(!monthly.has(key))monthly.set(key,{month:day.month,supervisorId:day.supervisorId,supervisorName:day.supervisorName,revenue:0,appointments:0,connections:0,sales:0,totalSales:0,totalRevenue:0,pipeline:0});
    const row=monthly.get(key);
    for(const metric of ['revenue','appointments','connections','sales','totalSales','totalRevenue','pipeline'])row[metric]=row[metric]===null||day[metric]===null?null:row[metric]+day[metric];
  }
  const data=validate({schemaVersion:1,source:'Salesforce CLI',status:'loaded',currency:'BRL',extractedAt:payload.extractedAt,startedAt:payload.startedAt,asOfDate:payload.today,
    range:{start:`${payload.startYear}-01`,end:`${payload.endYear}-12`},
    supervisorFieldLabel:'Supervisor de Hunter',supervisorFieldApiName:'HunterSupervisor__c',
    rules:{ticketApproved:true,amountField:payload.amountField,supervisorAttribution:'current_record_field',
      appointments:'Lead: COUNT(Id), mês de ScheduleDate__c, incluindo convertidos',
      connections:"Opportunity: DidTheMeetingTakePlace__c = 'Conectada', mês de MeetingDate__c; uma contagem por oportunidade",
      sales:'Opportunity: IsWon = true, por CloseDate (vendas pagas)',
      excludeLostSales:true,saleDateField:'CloseDate',
      revenue:`SUM(Opportunity.${payload.amountField}) em oportunidades ganhas (IsWon = true), por CloseDate (pago)`,
      totalSales:'Opportunity: Fechado Ganho ou Aguardando pagamento, por Dia_da_venda__c',
      totalRevenue:`SUM(Opportunity.${payload.amountField}) nas vendas Fechado Ganho ou Aguardando pagamento, por Dia_da_venda__c`,
      ticket:'Valor total de oportunidades ganhas / quantidade de oportunidades ganhas, no mesmo período',
      pipelineHistory:'not_available',pipeline:'Opportunity: IsClosed = false e Closer__c preenchido, mês de CloseDate'},
    supervisors:payload.supervisors,displayGroups:[...payload.supervisors,{id:'DISCONNECTED',name:'Desligados'}],firstDates:payload.firstDates||{},warnings,audits,coverage,closerSalesDaily:buildCloserSales(payload.closerSalesBatches||[]),
    rows:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.supervisorName.localeCompare(b.supervisorName,'pt-BR')),
    dailyRows:[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.supervisorName.localeCompare(b.supervisorName,'pt-BR'))});
  // Independent reconciliation of counts against the received query aggregates.
  for(const audit of audits.filter(a=>a.metric!=='pipeline')){
    const total=data.rows.filter(r=>r.month.startsWith(String(audit.year))).reduce((sum,r)=>sum+r[audit.metric],0);
    if(total!==audit.records)throw Error('Falha na reconciliação de contagens.');
  }
  return data;
}
if(require.main===module){
  try{
    const payload=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));
    const data=build(payload);
    const target=path.join(__dirname,'salesforce-data.js'),temp=target+'.tmp';
    fs.writeFileSync(temp,'// Agregados Salesforce; atualizado por sync-salesforce.ps1. Sem credenciais.\nwindow.SALESFORCE_DATA = '+JSON.stringify(data,null,2)+';\n');
    fs.renameSync(temp,target);
    console.log(JSON.stringify({status:'loaded',extractedAt:data.extractedAt,groups:data.rows.length,months:data.range,currentMonth:Object.fromEntries(['appointments','connections','totalSales','totalRevenue','sales','revenue','ticket','pipeline'].map(k=>[k,valueFor(data,payload.today.slice(0,7),k)])),warnings:data.warnings},null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={build};
