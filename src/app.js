import {todayInZone,chooseDay,choosePlan,readPerson,savePerson,validateCatalog,validatePlan,resolveResource} from './model.js';
import {renderPlan} from './render.js';

export function createApp({document,fetch,storage,now=()=>new Date(),catalogUrl}) {
  const byId=id=>document.getElementById(id);
  const root=byId('plan-root'),status=byId('status'),retry=byId('retry'),peopleSelect=byId('person-select'),planSelect=byId('plan-select');
  let catalog,person,entry,plan,sequence=0,disposed=false,retryAction,printState;
  const listeners=[];
  const on=(node,name,fn)=>{node.addEventListener(name,fn);listeners.push(()=>node.removeEventListener(name,fn));};
  const today=()=>todayInZone(now(),catalog.timeZone);
  const state=(message,error=false)=>{status.textContent=message;status.hidden=!message;retry.hidden=!error;root.setAttribute('aria-busy',String(!!message&&!error));};
  const reset=()=>{root.replaceChildren();byId('plan-nav').hidden=true;byId('calendar-status').textContent='';byId('today').disabled=true;};
  const json=async url=>{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();};
  function selectDay(date,focus=false) {
    if(!plan||!plan.days.some(day=>day.date===date))return;
    root.querySelectorAll('.day-tab').forEach(tab=>{const selected=tab.dataset.date===date;tab.classList.toggle('is-active',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();});
    root.querySelectorAll('.day-panel').forEach(panel=>{const selected=panel.dataset.date===date;panel.hidden=!selected;panel.classList.toggle('is-active',selected);});
    byId('day-status').textContent=root.querySelector('.day-panel.is-active h2').textContent;
    byId('calendar-status').textContent=date===today()?'Меню на сегодня':`Выбран ${new Intl.DateTimeFormat(catalog.locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))}`;
  }
  async function selectPlan(id) {
    entry=person.plans.find(p=>p.id===id);plan=null;const request=++sequence;reset();
    if(!entry){state(`${person.name}: рацион пока не добавлен.`);root.setAttribute('aria-busy','false');return;}
    planSelect.value=entry.id;state('Загрузка рациона…');retryAction=()=>selectPlan(entry.id);
    const requestedEntry=entry,requestedPerson=person;
    try {
      const url=resolveResource(requestedEntry.file,catalogUrl);const value=await json(url);validatePlan(value,requestedEntry,requestedPerson.id);
      if(request!==sequence||disposed)return;
      plan=value;root.replaceChildren(...renderPlan(document,plan,person,url,catalog.locale,today()));
      state('');byId('today').disabled=false;byId('plan-nav').hidden=false;
      byId('plan-nav').querySelectorAll('a').forEach(link=>{link.hidden=!root.querySelector(link.getAttribute('href'));});
      document.title=`${person.name} — ${plan.title}`;
      const date=chooseDay(plan.days.map(day=>day.date),today());selectDay(date);
      if(date!==today())byId('calendar-status').textContent+=' · На сегодня меню нет, показан ближайший день';
    } catch {
      if(request!==sequence||disposed)return;reset();state('Не удалось загрузить рацион. Проверьте подключение и попробуйте снова.',true);
    }
  }
  async function selectPerson(id) {
    if(!catalog)return;
    person=catalog.people.find(p=>p.id===id)??catalog.people[0];peopleSelect.value=person.id;savePerson(storage,person.id);
    document.title=`${person.name} — Рационы`;
    planSelect.replaceChildren(...person.plans.map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.title;return option;}));
    byId('plan-field').hidden=person.plans.length<2;
    return selectPlan(choosePlan(person.plans,today())?.id);
  }
  async function start() {
    const request=++sequence;reset();peopleSelect.disabled=true;state('Загрузка рационов…');retryAction=start;
    try {
      const value=validateCatalog(await json(catalogUrl));if(request!==sequence||disposed)return;catalog=value;
      peopleSelect.replaceChildren(...catalog.people.map(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;return option;}));peopleSelect.disabled=false;
      return selectPerson(readPerson(storage,catalog.people));
    } catch {if(request===sequence&&!disposed)state('Не удалось загрузить список рационов. Проверьте подключение и попробуйте снова.',true);}
  }
  async function goToday() {
    const nearest=choosePlan(person.plans,today());if(!nearest)return;
    if(!plan||entry.id!==nearest.id)return selectPlan(nearest.id);
    const date=chooseDay(plan.days.map(day=>day.date),today());selectDay(date,true);
    if(date!==today())byId('calendar-status').textContent+=' · На сегодня меню нет, показан ближайший день';
  }
  on(peopleSelect,'change',()=>selectPerson(peopleSelect.value));on(planSelect,'change',()=>selectPlan(planSelect.value));on(byId('today'),'click',goToday);on(retry,'click',()=>retryAction?.());
  on(root,'click',event=>{
    const tab=event.target.closest('[role="tab"]');if(tab){selectDay(tab.dataset.date);return;}
    const button=event.target.closest('.ingredient-info');if(!button)return;
    const original=byId(button.getAttribute('aria-controls'));original.hidden=!original.hidden;button.setAttribute('aria-expanded',String(!original.hidden));
  });
  on(root,'keydown',event=>{
    const button=event.target.closest('.ingredient-info');if(button&&event.key==='Escape'){byId(button.getAttribute('aria-controls')).hidden=true;button.setAttribute('aria-expanded','false');return;}
    const tab=event.target.closest('[role="tab"]');if(!tab)return;
    const tabs=[...root.querySelectorAll('.day-tab')];let i=tabs.indexOf(tab);
    if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;
    event.preventDefault();selectDay(tabs[i].dataset.date,true);
  });
  on(document.defaultView,'beforeprint',()=>{printState={date:root.querySelector('.day-tab.is-active')?.dataset.date,details:[...root.querySelectorAll('details')].map(el=>el.open)};root.querySelectorAll('.day-panel').forEach(el=>{el.hidden=false;});root.querySelectorAll('details').forEach(el=>{el.open=true;});});
  on(document.defaultView,'afterprint',()=>{if(!printState)return;selectDay(printState.date);root.querySelectorAll('details').forEach((el,i)=>{el.open=printState.details[i];});printState=null;});
  return {start,selectPerson,selectPlan,selectDay,goToday,destroy(){disposed=true;sequence++;listeners.forEach(remove=>remove());}};
}
