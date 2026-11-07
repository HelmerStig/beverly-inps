import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {dirname,resolve,relative,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8'};
export function createDemoServer(){
  return http.createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    try{
      let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/')pathname='/index.html';
      const file=resolve(root,'.'+pathname),local=relative(root,file);
      if(local.startsWith('..')||local.split(sep).some(p=>p.startsWith('.'))||!mime[extname(file).toLowerCase()]){res.writeHead(403);res.end('Accesso non consentito');return;}
      const actual=await realpath(file);
      if(relative(root,actual).startsWith('..')){res.writeHead(403);res.end('Accesso non consentito');return;}
      const info=await stat(actual);
      if(!info.isFile()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()],'Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD')res.end();else createReadStream(actual).on('error',()=>res.destroy()).pipe(res);
    }catch(error){res.writeHead(error instanceof URIError?400:404);res.end('File non disponibile');}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.argv[2]??4185);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Porta non valida');
  createDemoServer().listen(port,'127.0.0.1',()=>console.log(`Sanmauro: http://127.0.0.1:${port}/`));
}
