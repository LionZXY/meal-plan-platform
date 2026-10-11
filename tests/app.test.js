import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {fixtureCatalog,fixturePlan} from './fixtures.js';
import {createApp} from '../src/app.js';
const url='https://example.github.io/meal-plan-platform/';
const html=()=>readFile(new URL('../public/index.html',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(options={}) {
  const dom=new JSDOM(await html(),{url});
  const data={'content/catalog.json':fixtureCatalog(),'content/plans/nikita/plan.json':fixturePlan(),'content/plans/nastya/plan.json':fixturePlan('nastya')};
  const fetch=options.fetch??(async input=>({ok:true,json:async()=>structuredClone(data[new URL(input).pathname.replace('/meal-plan-platform/','')])}));
  const app=createApp({document:dom.window.document,fetch,storage:options.storage??dom.window.localStorage,now:()=>new Date('2026-10-11T10:00:00Z'),catalogUrl:new URL('content/catalog.json',url).href});
  return {dom,app,data,document:dom.window.document};
}
test('opens today and shows computed calories from runtime content',async()=>{
  const {app,document}=await setup();await app.start();
  assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').dataset.date,'2026-10-11');
  assert.match(document.querySelector('.day-panel.is-active').textContent,/365/);
});
test('both people have independent test meals; selection survives a new page load',async()=>{
  const {app,document,dom}=await setup();await app.start();
  const selector=document.querySelector('#person-select');selector.value='nastya';selector.dispatchEvent(new dom.window.Event('change'));await tick();
  assert.match(document.querySelector('#plan-root').textContent,/Рис с курицей/);
  const next=await setup({storage:dom.window.localStorage});await next.app.start();
  assert.equal(next.document.querySelector('#person-select').value,'nastya');
  assert.match(next.document.querySelector('.day-panel.is-active').textContent,/265/);
});
test('ingredient icons disclose literal original names and close with Escape',async()=>{
  const {app,document,dom}=await setup();await app.start();
  const button=document.querySelector('.day-panel.is-active .ingredient-info');button.click();
  assert.equal(button.getAttribute('aria-expanded'),'true');
  assert.match(document.getElementById(button.getAttribute('aria-controls')).textContent,/Test Chicken Breast/);
  button.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'false');
});
test('changing JSON updates menus without app changes and cannot inject markup',async()=>{
  const {app,document,data}=await setup();
  data['content/plans/nikita/plan.json'].days[1].meals[0].title='<img src=x onerror=alert(1)> New meal';
  data['content/plans/nikita/plan.json'].days[1].meals[0].ingredients[0].amount=300;
  await app.start();assert.match(document.querySelector('.day-panel.is-active h3').textContent,/<img/);
  assert.equal(document.querySelectorAll('img').length,0);
  assert.match(document.querySelector('.day-panel.is-active').textContent,/465/);
});
test('empty profiles, deleted persisted profile, and denied storage stay usable',async()=>{
  const {app,document,data}=await setup({storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
  data['content/catalog.json'].people[1].plans=[];
  await app.start();await app.selectPerson('nastya');
  assert.match(document.querySelector('#status').textContent,/пока не добавлен/);
  assert.equal(document.querySelector('#plan-root').children.length,0);
});
test('data load failure offers a working retry',async()=>{
  let failed=true;const data=fixtureCatalog();
  const {app,document}=await setup({fetch:async input=>{
    if(failed)return {ok:false,status:503};
    return {ok:true,json:async()=>input.endsWith('catalog.json')?data:fixturePlan()};
  }});
  await app.start();assert.match(document.querySelector('#status').textContent,/Не удалось/);
  failed=false;document.querySelector('#retry').click();await tick();
  assert.equal(document.querySelector('#person-select').value,'nikita');
  assert.ok(document.querySelector('.day-panel.is-active'));
});
test('a slow previous profile response cannot overwrite the current profile',async()=>{
  let resolveNikita;
  const {app,document}=await setup({fetch:async input=>{
    if(input.endsWith('catalog.json'))return {ok:true,json:async()=>fixtureCatalog()};
    if(input.includes('/nikita/'))return new Promise(resolve=>{resolveNikita=()=>resolve({ok:true,json:async()=>fixturePlan()});});
    return {ok:true,json:async()=>fixturePlan('nastya')};
  }});
  const starting=app.start();await tick();await app.selectPerson('nastya');resolveNikita();await starting;
  assert.equal(document.querySelector('#person-select').value,'nastya');
  assert.match(document.querySelector('#plan-root').textContent,/Рис с курицей/);
});
