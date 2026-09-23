(function(root){
  const definitions={
    hunter:[
      {key:'calledCnpjs',label:'CNPJs ligados',icon:'phone',tone:'blue'},
      {key:'calls',label:'Ligações efetuadas',icon:'phone',tone:'blue'},
      {key:'answeredCnpjs',label:'CNPJs atendidos',icon:'answered',tone:'purple'},
      {key:'answeredCalls',label:'Ligações atendidas',icon:'answered',tone:'purple'},
      {key:'appointments',label:'Agendamentos',icon:'calendar',tone:'blue'},
      {key:'connections',label:'Conexões',icon:'link',tone:'purple'},
      {key:'soldDeals',label:'Vendas',icon:'cart',tone:'orange'},
      {key:'soldAmount',label:'Vendas (R$)',icon:'cart',tone:'orange',money:true},
      {key:'paidDeals',label:'Pagos',icon:'money',tone:'green'},
      {key:'paidAmount',label:'Pagos (R$)',icon:'money',tone:'green',money:true}
    ],
    closer:[
      {key:'appointmentsReceived',label:'Agendamentos recebidos',icon:'calendar',tone:'blue'},
      {key:'connections',label:'Conexões',icon:'link',tone:'purple'},
      {key:'noShows',label:'No Show',icon:'calendar',tone:'pink'},
      {key:'futureMeetings',label:'Reuniões futuras',icon:'calendar',tone:'slate'},
      {key:'soldAmount',label:'Vendido',icon:'cart',tone:'orange',money:true,volumeKey:'soldDeals'},
      {key:'conversion',label:'Conversão',icon:'trend',tone:'purple',percent:true},
      {key:'paidAmount',label:'Recebido (pago)',icon:'money',tone:'green',money:true,volumeKey:'paidDeals'},
      {key:'pendingAmount',label:'Aguardando pagamento',icon:'ticket',tone:'slate',money:true},
      {key:'gapDue',label:'Gap devido',icon:'trend',tone:'pink',money:true}
    ]
  };
  const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  function validate(data){
    if(!data||data.schemaVersion!==1||!Array.isArray(data.members)||!Array.isArray(data.dailyRows))throw Error('Snapshot do Supabase incompatível.');
    return data;
  }
  const monthEnd=month=>`${month}-${String(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate()).padStart(2,'0')}`;
  function membersFor(data,role,{activeOnly=true,supervisorId}={}){
    return data.members.filter(member=>member.role===role&&(!activeOnly||member.status==='active')&&(supervisorId===undefined||member.supervisorId===supervisorId));
  }
  function selectedIds(data,role,memberIds){
    if(memberIds===undefined)return new Set(membersFor(data,role,{activeOnly:false}).map(member=>member.id));
    return new Set(Array.isArray(memberIds)?memberIds:[memberIds]);
  }
  function rowsFor(data,month,role,memberIds,cutoffDate=null){
    if(!validMonth(month))return [];
    const ids=selectedIds(data,role,memberIds),end=cutoffDate||monthEnd(month);
    return data.dailyRows.filter(row=>row.role===role&&ids.has(row.memberId)&&row.date.startsWith(month)&&row.date<=end);
  }
  function goalFor(data,month,memberIds,cutoffDate=null){
    const ids=selectedIds(data,'closer',memberIds);
    const full=(data.goals||[]).filter(goal=>goal.month===month&&ids.has(goal.memberId)).reduce((sum,goal)=>sum+(goal.amount||0),0);
    if(!cutoffDate||!root.DashboardData)return full;
    const elapsed=root.DashboardData.businessDayOrdinal(cutoffDate,data),total=root.DashboardData.businessDaysInMonth(month,data);
    return full*Math.min(1,elapsed/Math.max(1,total));
  }
  function valueFor(data,month,role,key,memberIds=undefined,cutoffDate=null){
    if(data.range&&(month<data.range.start||month>data.range.end))return null;
    const rows=rowsFor(data,month,role,memberIds,cutoffDate);
    if(key==='calledCnpjs'||key==='answeredCnpjs'){
      const field=key==='calledCnpjs'?'calledKeys':'answeredKeys';
      return new Set(rows.flatMap(row=>row[field]||[])).size;
    }
    if(key==='futureMeetings')return Math.max(0,valueFor(data,month,role,'appointmentsReceived',memberIds,cutoffDate)-valueFor(data,month,role,'connections',memberIds,cutoffDate)-valueFor(data,month,role,'noShows',memberIds,cutoffDate));
    if(key==='conversion'){
      const connections=valueFor(data,month,role,'connections',memberIds,cutoffDate),soldDeals=valueFor(data,month,role,'soldDeals',memberIds,cutoffDate);
      return connections>0?soldDeals/connections:0;
    }
    if(key==='gapDue')return Math.max(0,goalFor(data,month,memberIds,cutoffDate)-valueFor(data,month,role,'soldAmount',memberIds,cutoffDate));
    return rows.reduce((sum,row)=>sum+(Number.isFinite(row[key])?row[key]:0),0);
  }
  function dailyValueFor(data,date,role,key,memberId){
    const rows=data.dailyRows.filter(row=>row.date===date&&row.role===role&&row.memberId===memberId);
    if(key==='calledCnpjs'||key==='answeredCnpjs'){const field=key==='calledCnpjs'?'calledKeys':'answeredKeys';return new Set(rows.flatMap(row=>row[field]||[])).size;}
    if(key==='futureMeetings')return Math.max(0,dailyValueFor(data,date,role,'appointmentsReceived',memberId)-dailyValueFor(data,date,role,'connections',memberId)-dailyValueFor(data,date,role,'noShows',memberId));
    if(key==='conversion'){const connections=dailyValueFor(data,date,role,'connections',memberId),soldDeals=dailyValueFor(data,date,role,'soldDeals',memberId);return connections>0?soldDeals/connections:0;}
    if(key==='gapDue')return valueFor(data,date.slice(0,7),role,key,memberId,date);
    return rows.reduce((sum,row)=>sum+(Number.isFinite(row[key])?row[key]:0),0);
  }
  function supervisorGroups(data,role){return (data.supervisors?.[role]||[]).map(supervisor=>({...supervisor,members:membersFor(data,role,{supervisorId:supervisor.id})}));}
  const api={definitions,validate,membersFor,supervisorGroups,valueFor,dailyValueFor,monthEnd};
  if(typeof module!=='undefined')module.exports=api;else root.SupabaseData=api;
})(globalThis);
