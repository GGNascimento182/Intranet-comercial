const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const context={window:{},Intl,Date,Math,Set,Map,Array,Object,JSON,RegExp,String,Number,Boolean};
context.window.window=context.window;
vm.createContext(context);
for(const file of ['supabase-model.js','supabase-data.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),context,{filename:file});

const api=context.SupabaseData;
const dataset=api.validate(context.window.SUPABASE_DATA);
const month=dataset.asOfDate.slice(0,7);

assert.equal(dataset.schemaVersion,1);
assert.deepEqual([...dataset.supervisors.closer].map(item=>item.name).sort(),['Matheus Porto','Patrick Araújo']);
assert.ok(dataset.dailyRows.length>0);

for(const role of ['hunter','closer']){
  for(const definition of api.definitions[role]){
    const value=api.valueFor(dataset,month,role,definition.key);
    assert.ok(value===null||Number.isFinite(value),`${role}/${definition.key} deve ser numérico`);
  }
}

const called=api.valueFor(dataset,month,'hunter','calledCnpjs');
const calls=api.valueFor(dataset,month,'hunter','calls');
assert.ok(called<=calls,'CNPJs distintos não podem exceder o total de ligações');

const hunterIds=dataset.members.filter(member=>member.role==='hunter').map(member=>member.id);
for(const key of ['soldDeals','soldAmount','paidDeals','paidAmount']){
  assert.equal(api.valueFor(dataset,month,'hunter',key,hunterIds,dataset.asOfDate),api.valueFor(dataset,month,'closer',key,undefined,dataset.asOfDate),`${key} precisa reconciliar Hunter e Closer`);
}

const historyFixture={
  range:{start:'2026-01',end:'2026-12'},
  members:[
    {id:'closer-atual',sfUserId:'005-person',role:'closer',status:'active'},
    {id:'hunter-historico',sfUserId:'005-person',role:'hunter',status:'historical'}
  ],
  dailyRows:[
    {date:'2026-01-10',memberId:'hunter-historico',role:'hunter',soldDeals:1,soldAmount:2000,paidDeals:1,paidAmount:2000,connections:1},
    {date:'2026-01-12',memberId:'closer-atual',role:'closer',appointmentsReceived:1,connections:1,soldDeals:1,soldAmount:3000,paidDeals:0,paidAmount:0}
  ],
  goals:[]
};
assert.equal(api.historyValueFor(historyFixture,'2026-01','closer','soldAmount','closer-atual'),5000,'vendas históricas acompanham o identificador da pessoa');
assert.equal(api.historyValueFor(historyFixture,'2026-01','closer','appointmentsReceived','closer-atual'),1,'métricas de reunião preservam a função do evento');
