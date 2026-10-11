import {readFile,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCatalog,validatePlan,resolveResource} from '../src/model.js';
const ORIGIN='https://content.invalid';
export async function validateContent(root=process.cwd()) {
  const load=async url=>{
    if(new URL(url).origin!==ORIGIN)throw Error('Catalog plan files must be relative files in content/');
    const path=resolve(root,`.${decodeURIComponent(new URL(url).pathname)}`);
    if(!relative(resolve(root,'content'),path)||relative(resolve(root,'content'),path).startsWith('..'))throw Error('Plan path must stay inside content/');
    return {data:JSON.parse(await readFile(path,'utf8')),path};
  };
  const catalogUrl=`${ORIGIN}/content/catalog.json`;
  const {data}=await load(catalogUrl);const catalog=validateCatalog(data);let plans=0,meals=0,assets=0;
  for(const person of catalog.people)for(const entry of person.plans) {
    const url=resolveResource(entry.file,catalogUrl);const {data:plan}=await load(url);validatePlan(plan,entry,person.id);
    const images=[plan.hero,...plan.days.flatMap(day=>day.meals.map(meal=>meal.image))].filter(Boolean);
    for(const image of images) {
      const resource=resolveResource(image.src,url);if(new URL(resource).origin!==ORIGIN)continue;
      const path=resolve(root,`.${decodeURIComponent(new URL(resource).pathname)}`);
      if(!(await stat(path)).isFile())throw Error(`Image is not a file: ${image.src}`);assets++;
    }
    plans++;meals+=plan.days.reduce((sum,day)=>sum+day.meals.length,0);
  }
  return {people:catalog.people.length,plans,meals,assets};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log('Content valid:',await validateContent());}catch(error){console.error(error.message);process.exitCode=1;}
}
