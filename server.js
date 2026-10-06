import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const serverMode=process.env.AMMS_MODE==='server';
const root = resolve(process.argv[2] || (serverMode?'dist':'.'));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
if(serverMode && host!=='127.0.0.1' && host!=='localhost' && !process.env.AMMS_PUBLIC_URL?.startsWith('https://')) throw new Error('Remote server mode requires AMMS_PUBLIC_URL=https://... and a TLS reverse proxy.');
const api=serverMode?(await import('./api.js')).api:null;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
createServer(async (req,res) => {
  try {
    if(api && await api(req,res)) return;
    if(serverMode && req.url.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const target = (await stat(path)).isDirectory() ? resolve(path,'index.html') : path;
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': types[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port,host,()=>console.log(`AMMS running at http://${host}:${port}${serverMode?' (server mode)':''}`));
