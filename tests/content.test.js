import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateMeal,validatePlan,validateCatalog} from '../src/model.js';
import {validateContent} from '../scripts/validate-content.js';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
test('migrated plan preserves all 28 meals, quantities and unrounded nutrition', async () => {
  const plan=await json('./fixtures/legacy-plan.json');
  const expected=await json('./legacy-nutrition.json');
  validatePlan(plan);
  assert.equal(plan.days.flatMap(day=>day.meals).length,28);
  for(const row of expected) {
    const meal=plan.days.find(d=>d.date===row.date).meals.find(m=>m.id===row.mealId);
    assert.deepEqual(meal.ingredients,row.ingredients);
    const value=calculateMeal(meal,plan.products);
    for(const key of Object.keys(value))assert.ok(Math.abs(value[key]-row.nutrition[key])<1e-8,`${row.date} ${row.mealId} ${key}`);
  }
  assert.ok(!Object.hasOwn(plan.products,'oil'));
});
test('all registered production content and images pass validation, with no fixed names or menu',async()=>{
  const catalog=validateCatalog(await json('../content/catalog.json'));
  const result=await validateContent(new URL('../',import.meta.url).pathname);
  assert.equal(result.people,catalog.people.length);
  assert.equal(result.plans,catalog.people.reduce((sum,p)=>sum+p.plans.length,0));
});
