export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'];
const PERSON_KEY = 'meal-plan-platform.person';

export function todayInZone(now = new Date(), timeZone = 'Europe/London') {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
const distance = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
export function chooseDay(dates, today) {
  return [...dates].sort((a, b) => distance(a, today) - distance(b, today) || a.localeCompare(b))[0] ?? null;
}
export function choosePlan(plans, today) {
  const gap = plan => today < plan.startDate ? distance(today, plan.startDate) : today > plan.endDate ? distance(today, plan.endDate) : 0;
  return [...plans].sort((a, b) => gap(a) - gap(b) || a.startDate.localeCompare(b.startDate))[0] ?? null;
}
export function calculateMeal(meal, products) {
  return Object.fromEntries(NUTRIENTS.map(key => [key, meal.ingredients.reduce((sum, ingredient) => sum + products[ingredient.productId].nutritionPer100[key] * ingredient.amount / 100, 0)]));
}
export function calculateDay(day, products) {
  const meals = day.meals.map(meal => calculateMeal(meal, products));
  return Object.fromEntries(NUTRIENTS.map(key => [key, meals.reduce((sum, meal) => sum + meal[key], 0)]));
}
export function readPerson(storage, people) {
  try {
    const saved = storage?.getItem(PERSON_KEY);
    if (people.some(person => person.id === saved)) return saved;
  } catch { /* Storage can be unavailable in private browsing. */ }
  return people[0]?.id ?? null;
}
export function savePerson(storage, id) {
  try { storage?.setItem(PERSON_KEY, id); } catch { /* Viewing does not require storage. */ }
}

export function resolveResource(path, base) {
  if (typeof path !== 'string' || !path.trim() || path !== path.trim() || /[\\\u0000-\u001f]/.test(path)) throw Error('Invalid resource path');
  const external = /^https?:\/\//i.test(path);
  const decoded = decodeURIComponent(path);
  if (!external && (decoded !== decoded.trim() || decoded.startsWith('/') || decoded.split(/[/?#]/).includes('..') || /[\\\u0000-\u001f]/.test(decoded) || /^(?:[^/]*:|#)/.test(decoded))) throw Error(`Unsafe resource path: ${path}`);
  const url = new URL(path, base);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (!external && url.origin !== new URL(base).origin)) throw Error('Unsafe resource URL');
  if (!external && decodeURIComponent(url.pathname).split('/').includes('..')) throw Error('Unsafe resource path');
  return url.href;
}

function requireValue(condition, message) { if (!condition) throw Error(message); }
function object(value, label) { requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), `${label}: expected object`); }
function text(value, label) { requireValue(typeof value === 'string' && value.trim().length > 0, `${label}: expected nonempty text`); }
function number(value, label, minimum = 0) { requireValue(typeof value === 'number' && Number.isFinite(value) && value >= minimum, `${label}: invalid number`); }
function array(value, label, minimum = 0) { requireValue(Array.isArray(value) && value.length >= minimum, `${label}: expected array with at least ${minimum} items`); }
function id(value, label) { requireValue(typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value), `${label}: invalid id`); }
function date(value, label) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, `${label}: invalid calendar date`);
}
function unique(values, label) { requireValue(new Set(values).size === values.length, `${label}: duplicates`); }
function optionalText(value, label) { if (value !== undefined) text(value, label); }
function image(value, label) {
  if (value === undefined) return;
  object(value, label); text(value.alt, `${label}.alt`); resolveResource(value.src, 'https://content.invalid/plan.json');
}

export function validateCatalog(catalog) {
  object(catalog, 'catalog'); requireValue(catalog.schemaVersion === 1, 'Unsupported catalog schemaVersion');
  text(catalog.locale, 'locale'); text(catalog.timeZone, 'timeZone');
  new Intl.DateTimeFormat(catalog.locale, {timeZone: catalog.timeZone}).format(new Date());
  array(catalog.people, 'people', 1); unique(catalog.people.map(p => p.id), 'people');
  for (const person of catalog.people) {
    object(person, 'person'); id(person.id, 'person.id'); text(person.name, 'person.name'); array(person.plans, 'person.plans');
    unique(person.plans.map(plan => plan.id), 'plan ids');
    for (const plan of person.plans) {
      object(plan, 'plan entry'); id(plan.id, 'plan.id'); text(plan.title, 'plan.title'); date(plan.startDate, 'plan.startDate'); date(plan.endDate, 'plan.endDate');
      requireValue(plan.startDate <= plan.endDate, 'Plan date range is reversed'); resolveResource(plan.file, 'https://content.invalid/catalog.json');
    }
    const ordered = [...person.plans].sort((a,b) => a.startDate.localeCompare(b.startDate));
    for (let i=1;i<ordered.length;i++) requireValue(ordered[i].startDate > ordered[i-1].endDate, `Plan date ranges overlap for ${person.id}`);
  }
  return catalog;
}
export function validatePlan(plan, entry, personId) {
  object(plan, 'plan'); requireValue(plan.schemaVersion === 1, 'Unsupported plan schemaVersion');
  id(plan.id, 'plan.id'); id(plan.personId, 'personId'); text(plan.title, 'plan.title'); optionalText(plan.description, 'description');
  if (entry) requireValue(plan.id === entry.id, 'Catalog and plan IDs differ');
  if (personId) requireValue(plan.personId === personId, 'Plan belongs to another person');
  object(plan.products, 'products'); requireValue(Object.keys(plan.products).length > 0, 'No products');
  for (const [key, product] of Object.entries(plan.products)) {
    id(key, 'product id'); object(product, key); text(product.name, `${key}.name`); text(product.originalName, `${key}.originalName`);
    requireValue(['g', 'ml'].includes(product.unit), `${key}: unit must be g or ml`); object(product.nutritionPer100, `${key}.nutritionPer100`);
    NUTRIENTS.forEach(n => number(product.nutritionPer100[n], `${key}.${n}`));
    if (product.url) resolveResource(product.url, 'https://content.invalid/plan.json');
    optionalText(product.packageSize, `${key}.packageSize`);
  }
  array(plan.days, 'days', 1); unique(plan.days.map(day => day.date), 'day dates');
  for (const day of plan.days) {
    date(day.date, 'day.date'); array(day.meals, 'day.meals', 1); unique(day.meals.map(m => m.id), `meal IDs ${day.date}`);
    for (const meal of day.meals) {
      id(meal.id, 'meal.id'); text(meal.type, 'meal.type'); text(meal.title, 'meal.title'); text(meal.instructions, 'meal.instructions'); image(meal.image, 'meal.image');
      array(meal.ingredients, 'meal.ingredients', 1);
      for (const ingredient of meal.ingredients) {
        requireValue(Object.hasOwn(plan.products, ingredient.productId), `Unknown product: ${ingredient.productId}`);
        number(ingredient.amount, 'ingredient.amount', Number.MIN_VALUE);
      }
    }
  }
  const dates = plan.days.map(day => day.date).sort();
  if (entry) requireValue(dates[0] === entry.startDate && dates.at(-1) === entry.endDate, 'Catalog date range differs from plan');
  image(plan.hero, 'hero');
  for (const key of ['portionNote', 'nutritionNote', 'revision', 'sourceNote']) optionalText(plan[key], key);
  if (plan.facts) { array(plan.facts, 'facts'); plan.facts.forEach(f => {text(f.value, 'fact.value');text(f.label, 'fact.label');}); }
  if (plan.prep) {
    object(plan.prep, 'prep'); text(plan.prep.duration, 'prep.duration'); text(plan.prep.equipment, 'prep.equipment'); optionalText(plan.prep.note, 'prep.note');
    array(plan.prep.steps, 'prep.steps', 1);
    plan.prep.steps.forEach(step => ['time', 'title', 'text'].forEach(key => text(step[key], `prep.step.${key}`)));
  }
  if (plan.storage) {
    object(plan.storage, 'storage'); array(plan.storage.rules, 'storage.rules'); array(plan.storage.rows, 'storage.rows');
    plan.storage.rules.forEach(row => {text(row.title, 'storage.rule.title');text(row.text, 'storage.rule.text');});
    plan.storage.rows.forEach(row => ['product', 'when', 'note'].forEach(key => text(row[key], `storage.row.${key}`)));
    optionalText(plan.storage.note, 'storage.note');
    if (plan.storage.url) resolveResource(plan.storage.url, 'https://content.invalid/plan.json');
    if (plan.storage.details) {
      const details=plan.storage.details; text(details.title, 'storage.details.title'); text(details.text, 'storage.details.text'); array(details.items, 'storage.details.items');
      details.items.forEach(row => {text(row.label, 'storage.details.label');text(row.text, 'storage.details.text');}); optionalText(details.footer, 'storage.details.footer');
    }
  }
  if (plan.shopping) {
    object(plan.shopping, 'shopping'); array(plan.shopping.groups, 'shopping.groups'); optionalText(plan.shopping.note, 'shopping.note');
    plan.shopping.groups.forEach(group => {
      text(group.name, 'shopping.group.name'); array(group.items, 'shopping.group.items');
      group.items.forEach(item => {requireValue(Object.hasOwn(plan.products, item.productId), `Unknown shopping product: ${item.productId}`); number(item.quantity, 'shopping.quantity', 1); requireValue(Number.isInteger(item.quantity), 'Shopping quantity must be whole packs');});
    });
  }
}
