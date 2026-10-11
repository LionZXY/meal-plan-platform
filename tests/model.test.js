import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureCatalog, fixturePlan} from './fixtures.js';
import {todayInZone, chooseDay, choosePlan, calculateMeal, calculateDay, validateCatalog, validatePlan, resolveResource, readPerson, savePerson} from '../src/model.js';

test('London calendar date differs from UTC near midnight and handles DST', () => {
  assert.equal(todayInZone(new Date('2026-10-10T23:30:00Z'), 'Europe/London'), '2026-10-11');
  assert.equal(todayInZone(new Date('2026-10-25T23:30:00Z'), 'Europe/London'), '2026-10-25');
  assert.equal(todayInZone(new Date('2026-03-29T23:30:00Z'), 'Europe/London'), '2026-03-30');
});
test('selects today, otherwise nearest available date including a gap', () => {
  const dates=['2026-10-10','2026-10-12','2026-10-16'];
  assert.equal(chooseDay(dates, '2026-10-12'), '2026-10-12');
  assert.equal(chooseDay(dates, '2026-10-01'), '2026-10-10');
  assert.equal(chooseDay(dates, '2026-10-20'), '2026-10-16');
  assert.equal(chooseDay(dates, '2026-10-11'), '2026-10-10');
  assert.equal(chooseDay([], '2026-10-11'), null);
});
test('chooses the plan covering today, then nearest, and allows no plans', () => {
  const plans=[{id:'old',startDate:'2026-10-01',endDate:'2026-10-07'},{id:'now',startDate:'2026-10-10',endDate:'2026-10-16'}];
  assert.equal(choosePlan(plans,'2026-10-11').id,'now');
  assert.equal(choosePlan(plans,'2026-10-09').id,'now');
  assert.equal(choosePlan([],'2026-10-11'),null);
});
test('nutrition comes from displayed ingredient quantities for each person', () => {
  const p=fixturePlan();
  assert.deepEqual(calculateMeal(p.days[0].meals[0],p.products),{kcal:350,protein:43,fat:5,carbs:30});
  const nastya=fixturePlan('nastya');
  assert.deepEqual(calculateDay(nastya.days[0],nastya.products),{kcal:250,protein:23,fat:3,carbs:30});
});
test('valid catalog and plan work, empty profiles work', () => {
  const c=fixtureCatalog();c.people[1].plans=[];
  assert.equal(validateCatalog(c),c);
  assert.equal(validatePlan(fixturePlan()),undefined);
});
test('overlapping date ranges for the same person are rejected, avoiding ambiguous today selection', () => {
  const c=fixtureCatalog();
  c.people[0].plans.push({id:'nikita-second',title:'Вторая неделя',startDate:'2026-10-11',endDate:'2026-10-11',file:'plans/second/plan.json'});
  assert.throws(()=>validateCatalog(c),/overlap/);
});
test('validation rejects unknown products, duplicate dates and invalid quantities', () => {
  for(const change of [p=>p.days[0].meals[0].ingredients[0].productId='missing',p=>p.days[1].date=p.days[0].date,p=>p.days[0].date='2026-02-30',p=>p.days[0].meals[0].ingredients[0].amount=-1,p=>p.products.chicken.nutritionPer100.kcal=Infinity]) {
    const p=fixturePlan();change(p);assert.throws(()=>validatePlan(p));
  }
  const c=fixtureCatalog();c.people[1].id=c.people[0].id;assert.throws(()=>validateCatalog(c));
});
test('resource paths keep the GitHub Pages subpath and reject unsafe URLs', () => {
  const base='https://example.github.io/meal-plan-platform/content/plans/nikita/plan.json';
  assert.equal(resolveResource('images/meal.jpg',base),'https://example.github.io/meal-plan-platform/content/plans/nikita/images/meal.jpg');
  for(const bad of ['javascript:alert(1)','data:text/html,x','/images/meal.jpg','../secret','%2e%2e/secret','images/%2e%2e/%2e%2e/secret','images%2f..%2fsecret',' /images/meal.jpg',' ../secret.jpg','images/file.jpg ','https://user:password@example.com/meal.jpg'])assert.throws(()=>resolveResource(bad,base));
});
test('remember person, ignore removed profiles and survive blocked storage', () => {
  const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const people=fixtureCatalog().people;
  savePerson(storage,'nastya');assert.equal(readPerson(storage,people),'nastya');
  savePerson(storage,'removed');assert.equal(readPerson(storage,people),'nikita');
  const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(readPerson(blocked,people),'nikita');assert.doesNotThrow(()=>savePerson(blocked,'nastya'));
});
