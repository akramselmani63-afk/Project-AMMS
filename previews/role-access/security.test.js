import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {seed,addRequest,canRemoveIntervention,removeIntervention} from './src/workflow.js';
test('employees with matching display names cannot remove each other’s requests',()=>{
 const db=seed();db.role='Employee';db.actor='Same Name';db.actorEmail='owner@example.test';
 const r=addRequest(db,{title:'Test request',equipmentId:db.equipment[0].id});
 db.actorEmail='other@example.test';assert.equal(canRemoveIntervention(db,r),false);assert.throws(()=>removeIntervention(db,r.id));
 db.actorEmail='owner@example.test';assert.equal(canRemoveIntervention(db,r),true);
});
test('session revocation, malformed attachments and response security headers',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'agrimaint-security-'));process.env.AMMS_ACCESS_DATA_DIR=dir;
 const hash=password=>'testsalt:'+scryptSync(password,'testsalt',64).toString('hex');
 const users={'owner@example.test':{name:'Owner',role:'Employee',hash:hash('test password strong')}};
 await writeFile(join(dir,'users.json'),JSON.stringify(users));
 const {api}=await import('./api.js');const server=createServer((req,res)=>api(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'test password strong'})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const initial=await fetch(base+'/api/workspace',{headers:{cookie}});const {workspace}=await initial.json();
 const bad=await fetch(base+'/api/command',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({type:'new-request',values:{title:'Test',equipmentId:workspace.equipment[0].id,photos:[null]}})});
 assert.equal(bad.status,400,'malformed attachments are rejected without a server exception');
 users['owner@example.test'].hash=hash('changed password strong');await writeFile(join(dir,'users.json'),JSON.stringify(users));
 assert.equal((await fetch(base+'/api/workspace',{headers:{cookie}})).status,401,'password replacement revokes earlier sessions');
 assert.equal(login.headers.get('x-frame-options'),'DENY');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});

test('static server blocks links outside its web root and denies framing',async()=>{
 const {spawn}=await import('node:child_process');const {mkdir,symlink}=await import('node:fs/promises');
 const dir=await mkdtemp(join(tmpdir(),'agrimaint-static-')),site=join(dir,'site'),outside=join(dir,'private');
 await mkdir(site);await mkdir(outside);await writeFile(join(site,'index.html'),'public test');await writeFile(join(outside,'secret.txt'),'private test marker');await symlink(outside,join(site,'linked'),'junction');
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const child=spawn(process.execPath,['server.js',site],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',AMMS_ACCESS_PORT:String(port),AMMS_ACCESS_ADMIN_TOKEN:'',AMMS_TLS_PFX:'',AMMS_ACCESS_DATA_DIR:join(dir,'data')},stdio:['ignore','pipe','pipe']});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code))});child.stdout.on('data',()=>{clearTimeout(timer);resolve()});});
 const good=await fetch(`http://127.0.0.1:${port}/`);assert.equal(good.status,200);assert.equal(good.headers.get('x-frame-options'),'DENY');assert.match(good.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const linked=await fetch(`http://127.0.0.1:${port}/linked/secret.txt`);assert.equal(linked.status,403);assert.doesNotMatch(await linked.text(),/private test marker/);
 }finally{child.kill();if(child.exitCode===null)await once(child,'exit');await rm(dir,{recursive:true,force:true});}
});
