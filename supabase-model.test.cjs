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
