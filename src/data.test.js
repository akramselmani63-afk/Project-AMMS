import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, can, addRequest, createWorkOrder, completePreventive, equipmentPath, load, save } from './data.js';
test('request to work order flow preserves equipment and triage state',()=>{
  const data=seed();
  const request=addRequest(data,{title:'Motor vibration',equipmentId:'EQ-004',severity:'S2',priority:'P2'});
  assert.equal(request.status,'New');
  const work=createWorkOrder(data,{title:'Inspect motor',equipmentId:request.equipmentId,requestId:request.id,priority:request.priority});
  assert.equal(work.requestId,request.id);
  assert.equal(request.status,'Approved');
  assert.equal(equipmentPath(data.equipment,work.equipmentId),'Production / Packaging line 1 / Sewing station');
});
test('preventive completion moves due date and records activity',()=>{
  const data=seed(); const oldCount=data.reports.length;
  completePreventive(data,'PM-001');
  assert.equal(data.reports.length,oldCount+1);
  assert.match(data.reports[0].summary,/Completed preventive task/);
});
test('roles and browser persistence are explicit demo boundaries',()=>{
  const data=seed(); assert.equal(can('Requester','work:create'),false); assert.equal(can('Planner','work:create'),true);
  const memory={value:null,getItem(){return this.value},setItem(_key,value){this.value=value}};
  save(data,memory); assert.equal(load(memory).equipment.length,data.equipment.length);
});
