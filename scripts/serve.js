import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
const args=process.argv.slice(2),argument=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(argument('--port','18763')),base=argument('--base','/'),root=resolve('dist');
if(!base.startsWith('/')||!base.endsWith('/'))throw Error('--base must start and end with /');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith(base)){res.writeHead(404);res.end();return;}
    const file=resolve(root,pathname.slice(base.length)||'index.html');
    if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return;}
    if(!(await stat(file)).isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}${base}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
