import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { seed } from './src/workflow.js';
import { applyCommand, recordIds, newRecordIds, assignCreated } from './src/commands.js';

test('offline direct assignment keeps its request and work linked after ID assignment',()=>{
  const db=seed();db.role='Maintenance Responsible';db.actor='Test Responsible';
  const before=recordIds(db);
  applyCommand(db,{type:'new-work',values:{title:'Check motor',equipmentId:db.equipment[0].id,dueDate:'2026-10-01',priority:'P2',participants:['Maintenance Engineer']}});
  assignCreated(db,before,newRecordIds(db,before));
  assert.match(db.requests[0].id,/^IR-[a-f0-9]{32}$/);
  assert.equal(db.workOrders[0].requestId,db.requests[0].id);
});

test('company server shares records and enforces account roles',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'amms-server-test-'));
  process.env.AMMS_DATA_DIR=directory;
  process.env.AMMS_EMAIL_DOMAIN='example.test';
  const {api}=await import('./api.js');
  const invite='test-activation-code';
  const inviteHash=createHash('sha256').update(invite).digest('hex');
  await writeFile(join(directory,'users.json'),JSON.stringify({
    'employee@example.test':{name:'Test Employee',role:'Employee',inviteHash},
    'hse@example.test':{name:'Test HSE',role:'HSE',inviteHash}
  }));
  const server=createServer((req,res)=>{api(req,res);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,method='GET',data,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(data?{'content-type':'application/json',origin:base}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    assert.equal((await request('/api/signup','POST',{email:'employee@example.test',password:'a strong test password',invite:'wrong'})).status,400);
    for(const email of ['employee@example.test','hse@example.test']) assert.equal((await request('/api/signup','POST',{email,password:'a strong test password',invite})).status,201);
    const employee=(await request('/api/login','POST',{email:'employee@example.test',password:'a strong test password'})).cookie;
    const hse=(await request('/api/login','POST',{email:'hse@example.test',password:'a strong test password'})).cookie;
    const initial=await request('/api/workspace','GET',null,employee);
    const equipmentId=initial.data.workspace.equipment[0].id;
    const id=`IR-${'a'.repeat(32)}`, key='11111111-1111-4111-8111-111111111111';
    const command={type:'new-request',values:{title:'Test fault',equipmentId,reportedBy:'Test Employee'},created:{equipment:[],requests:[id],workOrders:[],preventive:[],partRequests:[],reports:[]},key};
    assert.equal((await request('/api/command','POST',command,employee)).status,200);
    assert.equal((await request('/api/revision','GET',null,hse)).data.revision,1);
    assert.equal((await request('/api/command','POST',command,employee)).data.workspace.requests.filter(r=>r.id===id).length,1);
    assert.equal((await request('/api/command','POST',command,hse)).status,409);
    const shared=await request('/api/workspace','GET',null,hse);
    assert.equal(shared.data.workspace.requests[0].id,id);
    assert.equal(shared.data.workspace.role,'HSE');
    assert.doesNotMatch(await readFile(join(directory,'users.json'),'utf8'),/a strong test password/);
  } finally { server.close();await once(server,'close');await rm(directory,{recursive:true,force:true}); }
});
