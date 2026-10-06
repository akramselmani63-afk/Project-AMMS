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
  const db=seed({examples:true});db.role='Maintenance Responsible';db.actor='Test Responsible';
  const before=recordIds(db);
  applyCommand(db,{type:'new-work',values:{title:'Check motor',equipmentId:db.equipment[0].id,dueDate:'2026-10-01',priority:'P2',participants:['Maintenance Engineer']}});
  assignCreated(db,before,newRecordIds(db,before));
  assert.match(db.requests[0].id,/^IR-\d{8}-\d{6}(?:-\d{2,})?$/);
  assert.equal(db.workOrders[0].requestId,db.requests[0].id);
});

test('company server shares records and enforces account roles',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'amms-access-preview-server-test-'));
  process.env.AMMS_ACCESS_DATA_DIR=directory;
  process.env.AMMS_ACCESS_EMAIL_DOMAIN='example.test';
  process.env.AMMS_ACCESS_ADMIN_TOKEN='test-admin-secret';
  const {api}=await import('./api.js');
  const invite='test-activation-code';
  const inviteHash=createHash('sha256').update(invite).digest('hex');
  await writeFile(join(directory,'users.json'),JSON.stringify({
    'employee@example.test':{name:'Test Employee',role:'Employee',inviteHash},
    'hse@example.test':{name:'Test HSE',role:'HSE',inviteHash},
    'viewer@example.test':{name:'Test Employee',role:'Developer Admin',inviteHash}
  }));
  const server=createServer((req,res)=>{api(req,res);});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,method='GET',data,cookie='',adminKey='')=>{
    const response=await fetch(base+path,{method,headers:{...(data?{'content-type':'application/json',origin:base}:{}),...(cookie?{cookie}:{}),...(adminKey?{'x-amms-access-preview-admin-token':adminKey}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    assert.equal((await request('/api/signup','POST',{email:'employee@example.test',password:'a strong test password',invite:'wrong'})).status,400);
    assert.equal((await request('/api/admin/users')).status,401);
    const listed=await request('/api/admin/users','GET',null,'','test-admin-secret');
    assert.equal(listed.status,200);
    assert.equal(listed.data.users.some(user=>'hash' in user || 'inviteHash' in user),false);
    const provisioned=await request('/api/admin/users','POST',{action:'provision',name:'Test',surname:'Planner',job:'Maintenance Planner',email:'planner@example.test',role:'Maintenance Engineer'},'','test-admin-secret');
    assert.equal(provisioned.status,200);
    assert.equal((await request('/api/signup','POST',{email:'planner@example.test',password:'a strong planner password',invite:provisioned.data.activationCode})).status,201);
    const plannerLogin=await request('/api/login','POST',{email:'planner@example.test',password:'a strong planner password'});
    assert.equal(plannerLogin.data.user.name,'Test Planner');
    const plannerSession=plannerLogin.cookie;
    assert.ok(plannerSession);
    const reset=await request('/api/admin/users','POST',{action:'reset',name:'Test',surname:'Planner',job:'Maintenance Planner',email:'planner@example.test',role:'Maintenance Engineer'},'','test-admin-secret');
    assert.equal(reset.status,200);
    assert.equal((await request('/api/workspace','GET',null,plannerSession)).status,401);
    assert.equal((await request('/api/login','POST',{email:'planner@example.test',password:'a strong planner password'})).status,401);
    assert.equal((await request('/api/signup','POST',{email:'planner@example.test',password:'a newer planner password',invite:reset.data.activationCode})).status,201);
    assert.equal((await request('/api/signup','POST',{email:'planner@example.test',password:'a third planner password',invite:reset.data.activationCode})).status,400);
    assert.equal((await request('/api/login','POST',{email:'planner@example.test',password:'a newer planner password'})).status,200);
    for(const email of ['employee@example.test','hse@example.test','viewer@example.test']) assert.equal((await request('/api/signup','POST',{email,password:'a strong test password',invite})).status,201);
    const employee=(await request('/api/login','POST',{email:'employee@example.test',password:'a strong test password'})).cookie;
    const hse=(await request('/api/login','POST',{email:'hse@example.test',password:'a strong test password'})).cookie;
    const viewerLogin=await request('/api/login','POST',{email:'viewer@example.test',password:'a strong test password'});
    const viewer=viewerLogin.cookie;
    assert.equal(viewerLogin.data.user.role,'Viewer');
    const initial=await request('/api/workspace','GET',null,employee);
    const equipmentId=initial.data.workspace.equipment[0].id;
    const id='IR-20260930-120000', key='11111111-1111-4111-8111-111111111111';
    const command={type:'new-request',values:{title:'Test fault',equipmentId,reportedBy:'Test Employee'},created:{equipment:[],requests:[id],workOrders:[],preventive:[],partRequests:[],reports:[]},key};
    assert.equal((await request('/api/command','POST',command,employee)).status,200);
    assert.equal((await request('/api/command','POST',{type:'remove-intervention',id,key:'22222222-2222-4222-8222-222222222222'},viewer)).status,409);
    assert.equal((await request('/api/command','POST',{...command,key:'33333333-3333-4333-8333-333333333333'},viewer)).status,409);
    assert.equal((await request('/api/revision','GET',null,hse)).data.revision,1);
    assert.equal((await request('/api/command','POST',command,employee)).data.workspace.requests.filter(r=>r.id===id).length,1);
    assert.equal((await request('/api/command','POST',command,hse)).status,409);
    const shared=await request('/api/workspace','GET',null,hse);
    assert.equal(shared.data.workspace.requests[0].id,id);
    assert.equal(shared.data.workspace.requests[0].reportedBy,'Test Employee');
    assert.equal(shared.data.workspace.requests[0].reportedRole,'Employee');
    assert.equal(shared.data.workspace.role,'HSE');
    assert.doesNotMatch(await readFile(join(directory,'users.json'),'utf8'),/a strong test password/);
    const queued={...command,values:{...command.values,title:'Previously queued fault'},created:{...command.created,requests:[`IR-${'b'.repeat(32)}`]},key:'44444444-4444-4444-8444-444444444444'};
    const migrated=await request('/api/command','POST',queued,employee);
    assert.equal(migrated.status,200);
    assert.match(migrated.data.workspace.requests[0].id,/^IR-\d{8}-\d{6}(?:-\d{2,})?$/);
    const machine=initial.data.workspace.equipment.find(e=>e.kind==='Machine');
    const measurements={type:'record-reliability',values:{equipmentId:machine.id,startDate:'2026-09-01',endDate:'2026-09-30',operatingHours:240,failureCount:2,maintenanceCount:6},key:'55555555-5555-4555-8555-555555555555'};
    assert.equal((await request('/api/command','POST',measurements,viewer)).status,409);
    const engineer=(await request('/api/login','POST',{email:'planner@example.test',password:'a newer planner password'})).cookie;
    assert.equal((await request('/api/command','POST',measurements,engineer)).status,200);
    const savedMeasurements=(await request('/api/workspace','GET',null,viewer)).data.workspace.equipment.find(e=>e.id===machine.id).reliabilityLog;
    assert.equal(savedMeasurements[0].operatingHours,240);
    assert.equal((await request('/api/command','POST',measurements,engineer)).data.workspace.equipment.find(e=>e.id===machine.id).reliabilityLog.length,1,'offline replay does not duplicate measurements');
  } finally { server.close();await once(server,'close');await rm(directory,{recursive:true,force:true}); }
});
