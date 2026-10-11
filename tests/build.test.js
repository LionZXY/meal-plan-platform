import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {build} from '../scripts/build.js';
import {fixtureCatalog,fixturePlan} from './fixtures.js';
async function project(t) {
  const root=await mkdtemp(join(tmpdir(),'meal-platform-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(new URL('../public/',import.meta.url),resolve(root,'public'),{recursive:true});await cp(new URL('../src/',import.meta.url),resolve(root,'src'),{recursive:true});
  const catalog=fixtureCatalog();await mkdir(resolve(root,'content'),{recursive:true});
  await writeFile(resolve(root,'content/catalog.json'),JSON.stringify(catalog));
  for(const person of catalog.people){const path=resolve(root,`content/plans/${person.id}`);await mkdir(path,{recursive:true});await writeFile(resolve(path,'plan.json'),JSON.stringify(fixturePlan(person.id)));}
  return root;
}
test('build keeps project-relative URLs, preserves JSON and publishes only app/content assets',async t=>{
  const root=await project(t);const built=await build({root});
  const html=await readFile(resolve(root,'dist/index.html'),'utf8');
  const path=html.match(/name="meal-catalog" content="([^"]+)"/)[1];
  const url=new URL(path,'https://example.github.io/meal-plan-platform/');
  assert.ok(url.pathname.startsWith('/meal-plan-platform/content/'));
  assert.equal(await readFile(resolve(root,'dist',path),'utf8'),await readFile(resolve(root,'content/catalog.json'),'utf8'));
  assert.deepEqual((await readdir(resolve(root,'dist'))).filter(f=>!f.startsWith('styles.')).sort(),['.nojekyll','assets','content','index.html']);
  await readFile(resolve(root,`dist/assets/app-${built.codeHash}/boot.js`));
});
test('a data-only edit changes published content while leaving application code unchanged',async t=>{
  const root=await project(t);const first=await build({root});
  const path=resolve(root,'content/plans/nastya/plan.json');const plan=JSON.parse(await readFile(path,'utf8'));plan.title='Новый рацион из данных';await writeFile(path,JSON.stringify(plan));
  const second=await build({root});assert.equal(second.codeHash,first.codeHash);assert.notEqual(second.contentHash,first.contentHash);
  assert.equal(JSON.parse(await readFile(resolve(root,`dist/content/${second.contentHash}/plans/nastya/plan.json`),'utf8')).title,plan.title);
});
test('invalid content fails build before replacing the last valid output',async t=>{
  const root=await project(t);await build({root});const before=await readFile(resolve(root,'dist/index.html'),'utf8');
  const path=resolve(root,'content/plans/nikita/plan.json');const plan=JSON.parse(await readFile(path,'utf8'));plan.days[0].meals[0].ingredients[0].productId='unknown';await writeFile(path,JSON.stringify(plan));
  await assert.rejects(build({root}),/Unknown product/);assert.equal(await readFile(resolve(root,'dist/index.html'),'utf8'),before);
});
