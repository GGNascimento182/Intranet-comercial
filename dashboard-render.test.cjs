const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const registry=new Map();
class Element{
  constructor(){this.children=[];this.attrs={};this.dataset={};this.validity={valid:true};this.classList={toggle(){},add(){},remove(){}};this.value='';this.hidden=false;this.innerHTML='';}
  append(element){this.children.push(element);element.isConnected=true;element.connectedCallback?.();}
  replaceChildren(){this.children=[];}
  addEventListener(name,listener){this.listeners??={};this.listeners[name]=listener;}
  setAttribute(key,value){this.attrs[key]=value;}
  getAttribute(key){return this.attrs[key]??null;}
  hasAttribute(key){return key in this.attrs;}
  removeAttribute(key){delete this.attrs[key];}
}
const roots=Object.fromEntries(['#report-month','#connection-status','#source-details','#macro-metrics','#history-metrics','#history-period','#history-mode','#history-cutoff','#cutoff-label','#chart-style','#bp-month','#bp-status','#bp-table','#bp-history'].map(key=>[key,new Element()]));
roots['#history-mode'].value='mtd';
roots['#chart-style'].value='area';
const context={
  console,Intl,Date,Math,Set,Map,Array,Object,JSON,RegExp,String,Number,Boolean,HTMLElement:Element,
  customElements:{define:(key,value)=>registry.set(key,value)},
  document:{querySelector:key=>roots[key],querySelectorAll:()=>[],createElement:key=>new (registry.get(key))(),body:{classList:{toggle(){}}}},
  location:{hash:''},window:{addEventListener(){},location:{hash:''}}
};
context.window.window=context.window;
vm.createContext(context);
for(const file of ['components.js','data-model.js','salesforce-data.js','crm-components.js','business-plan-config.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),context,{filename:file});
roots['crm-team']=new (registry.get('crm-team'))();
for(const file of ['crm-app.js','business-plan.js'])vm.runInContext(fs.readFileSync(`${__dirname}/${file}`,'utf8'),context,{filename:file});
assert.equal(roots['#macro-metrics'].children.length,8);
assert.equal(roots['#history-metrics'].children.length,6);
assert.match(roots['crm-team'].innerHTML,/Desligados/);
assert.match(roots['#bp-table'].innerHTML,/Diagnóstico/);
assert.match(roots['#bp-history'].innerHTML,/BP/);
assert.match(roots['#bp-status'].textContent,/dia útil/);
for(const element of [...roots['#macro-metrics'].children,...roots['#history-metrics'].children])assert.doesNotMatch(element.innerHTML,/NaN|undefined/);
