(function(root){
  const definitions=[
    {key:'revenue',label:'Receita (R$)',icon:'money',tone:'green',money:true},
    {key:'calls',label:'Ligações efetuadas',icon:'phone',tone:'blue',source:'dialer'},
    {key:'answered',label:'Ligações atendidas',icon:'answered',tone:'purple',source:'dialer'},
    {key:'appointments',label:'Agendamentos',icon:'calendar',tone:'blue'},
    {key:'connections',label:'Conexões',icon:'link',tone:'purple'},
    {key:'sales',label:'Vendas',icon:'cart',tone:'orange'},
    {key:'ticket',label:'TM (R$)',icon:'ticket',tone:'green',money:true},
    {key:'pipeline',label:'Pipeline (R$)',icon:'layers',tone:'slate',money:true,note:'Abertas na extração · mês previsto de fechamento'}
  ];
  // Métricas auxiliares para o Business Plan. Não compõem os cartões do Dashboard.
  const storedDefinitions=[...definitions,{key:'totalSales',label:'Vendas totais'},{key:'totalRevenue',label:'Vendas totais (R$)',money:true}];
  const validMonth=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  const fixedNationalHolidays=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];
  function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month-1,day));}
  function isoDate(date){return date.toISOString().slice(0,10);}
  function nationalHolidays(year){const easter=easterSunday(year);const addDays=(date,days)=>new Date(date.getTime()+days*86400000);const holidays=[...fixedNationalHolidays.map(day=>`${year}-${day}`),isoDate(addDays(easter,-2))];if(year>=2024)holidays.push(`${year}-11-20`);return new Set(holidays);}
  function holidaySet(data,year){return new Set([...(data.businessCalendar?.holidays||[]),...nationalHolidays(year)]);}
  function isBusinessDay(date,data={}){const parsed=new Date(`${date}T00:00:00Z`);return parsed.getUTCDay()!==0&&parsed.getUTCDay()!==6&&!holidaySet(data,parsed.getUTCFullYear()).has(date);}
  function businessDayOrdinal(date,data={}){const month=date.slice(0,7),day=Number(date.slice(8,10));let count=0;for(let i=1;i<=day;i++){const candidate=`${month}-${String(i).padStart(2,'0')}`;if(isBusinessDay(candidate,data))count++;}return count;}
  function businessDayCutoff(month,ordinal,data={}){if(!Number.isInteger(ordinal)||ordinal<1)return null;const [year,monthNumber]=month.split('-').map(Number),last=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();let count=0,lastBusiness=null;for(let i=1;i<=last;i++){const candidate=`${month}-${String(i).padStart(2,'0')}`;if(isBusinessDay(candidate,data)){count++;lastBusiness=candidate;if(count===ordinal)return candidate;}}return lastBusiness;}
  function businessDaysInMonth(month,data={}){const [year,monthNumber]=month.split('-').map(Number),last=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();let count=0;for(let i=1;i<=last;i++)if(isBusinessDay(`${month}-${String(i).padStart(2,'0')}`,data))count++;return count;}
  function validate(data){
    if(data.schemaVersion!==1||!Array.isArray(data.rows)||!Array.isArray(data.coverage))throw Error('Formato de dados incompatível.');
    for(const [collection,dayGrain] of [[data.rows,false],[data.dailyRows||[],true]]){
    const seen=new Set();
    for(const row of collection){
      if(!validMonth(row.month)||!(row.supervisorId===null||typeof row.supervisorId==='string')||typeof row.supervisorName!=='string')throw Error('Mês ou supervisor inválido.');
      if(dayGrain&&(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.date.slice(0,7)!==row.month||new Date(`${row.date}T00:00:00Z`).toISOString().slice(0,10)!==row.date))throw Error('Data diária inválida.');
      const key=JSON.stringify([dayGrain?row.date:row.month,row.supervisorId]);
      if(seen.has(key))throw Error('Supervisor duplicado no mesmo mês.');seen.add(key);
      for(const d of storedDefinitions.filter(d=>d.source!=='dialer'&&d.key!=='ticket')){
        const v=row[d.key];
        // Snapshots anteriores à inclusão das métricas auxiliares não as possuem.
        // A ausência é aceita só nelas; os indicadores originais continuam obrigatórios.
        if(v===undefined&&['totalSales','totalRevenue'].includes(d.key))continue;
        if(v!==null&&(!Number.isFinite(v)||(['appointments','connections','sales','totalSales'].includes(d.key)&&(!Number.isInteger(v)||v<0))))throw Error(`Valor inválido: ${d.key}. Use null para indisponível.`);
      }
    }
    }
    const coverageKeys=new Set();
    for(const c of data.coverage){
      if(!validMonth(c.month)||!storedDefinitions.some(d=>d.key===c.metric&&d.source!=='dialer'&&d.key!=='ticket')||typeof c.complete!=='boolean')throw Error('Cobertura inválida.');
      const key=c.month+':'+c.metric;if(coverageKeys.has(key))throw Error('Cobertura duplicada.');coverageKeys.add(key);
    }
    return data;
  }
  function valueFor(data,month,key,supervisorId=undefined,cutoffDay=null){
    if(key==='calls'||key==='answered')return null;
    if(key==='ticket'){
      if(!data.rules?.ticketApproved)return null;
      const revenue=valueFor(data,month,'revenue',supervisorId,cutoffDay),sales=valueFor(data,month,'sales',supervisorId,cutoffDay);
      return revenue===null||sales===null||sales===0?null:revenue/sales;
    }
    if(!data.coverage.some(c=>c.month===month&&c.metric===key&&c.complete))return null;
    if(cutoffDay!==null&&(!(Number.isInteger(cutoffDay)&&cutoffDay>=1&&cutoffDay<=31)&&!(typeof cutoffDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(cutoffDay))||!Array.isArray(data.dailyRows)))return null;
    const rows=(cutoffDay===null?data.rows:data.dailyRows).filter(r=>r.month===month&&(supervisorId===undefined||r.supervisorId===supervisorId)&&(cutoffDay===null||(typeof cutoffDay==='string'?r.date<=cutoffDay:Number(r.date.slice(8,10))<=cutoffDay)));
    if(rows.some(r=>r[key]===null))return null;
    return rows.reduce((sum,row)=>sum+row[key],0);
  }
  function monthsThrough(month,count=12){
    const [year,m]=month.split('-').map(Number);
    return Array.from({length:count},(_,i)=>new Date(Date.UTC(year,m-count+i,1)).toISOString().slice(0,7));
  }
  const comparison=(current,previous)=>current===null||previous===null||previous===0?null:(current-previous)/previous*100;
  const api={definitions,validate,valueFor,monthsThrough,comparison,isBusinessDay,businessDayOrdinal,businessDayCutoff,businessDaysInMonth};
  if(typeof module!=='undefined')module.exports=api;else root.DashboardData=api;
})(globalThis);
