import {cp,readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateContent} from './validate-content.js';
async function hashFolder(path) {
  const hash=createHash('sha256');
  async function walk(dir,prefix=''){
    const entries=(await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){const name=join(prefix,entry.name);if(entry.isSymbolicLink())throw Error(`Symlink is not supported: ${name}`);if(entry.isDirectory())await walk(join(dir,entry.name),name);else{hash.update(name);hash.update(await readFile(join(dir,entry.name)));}}
  }
  await walk(path);return hash.digest('hex').slice(0,16);
}
export async function build({root=process.cwd(),outDir=resolve(root,'dist')}={}) {
  const validated=await validateContent(root);
  const codeHash=await hashFolder(resolve(root,'src')),contentHash=await hashFolder(resolve(root,'content'));
  const css=await readFile(resolve(root,'public/styles.css'));const cssHash=createHash('sha256').update(css).digest('hex').slice(0,16);
  let html=await readFile(resolve(root,'public/index.html'),'utf8');
  html=html.replace('./styles.css',`./styles.${cssHash}.css`).replace('./src/boot.js',`./assets/app-${codeHash}/boot.js`).replace('./content/catalog.json',`./content/${contentHash}/catalog.json`);
  await rm(outDir,{recursive:true,force:true});await mkdir(outDir,{recursive:true});
  await cp(resolve(root,'src'),resolve(outDir,`assets/app-${codeHash}`),{recursive:true});
  await cp(resolve(root,'content'),resolve(outDir,`content/${contentHash}`),{recursive:true});
  await writeFile(resolve(outDir,`styles.${cssHash}.css`),css);await writeFile(resolve(outDir,'index.html'),html);await writeFile(resolve(outDir,'.nojekyll'),'');
  return {...validated,codeHash,contentHash,outDir};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log('Built:',await build());}catch(error){console.error(error.message);process.exitCode=1;}
}
