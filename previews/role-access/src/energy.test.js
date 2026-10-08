import test from 'node:test';import assert from 'node:assert/strict';import {seed,saveEnergyRecord,utilityParameters} from './workflow.js';import {workspaceForRole,canSeePage} from './access.js';import {applyCommand,recordIds,newRecordIds,assignCreated} from './commands.js';
test('energy and utility readings preserve zero, validate limits, update with history and enforce access',()=>{
 const db=seed();db.role='Maintenance Engineer';db.actor='Engineer';
 const before=recordIds(db);const r=applyCommand(db,{type:'save-energy',values:{kind:'energy',date:'2026-10-08',electricity:'12.5',water:'0',diesel:''}});
 assert.deepEqual(r.values,{electricity:12.5,water:0});assignCreated(db,before,newRecordIds(db,before));assert.match(r.id,/^EN-[a-f0-9]{32}$/);
 const id=r.id;saveEnergyRecord(db,{kind:'energy',date:'2026-10-08',electricity:20});assert.equal(db.energyRecords.length,1);assert.equal(r.id,id);assert.equal(r.history.length,2);
 const utility=saveEnergyRecord(db,{kind:'utility',date:'2026-10-08',shift:'Day',airPressure:'0',waterLevel:100,upsAlarm:'1',pumpState:'Stopped'});assert.equal(utility.values.airPressure,0);assert.equal(utility.values.upsAlarm,1);
 saveEnergyRecord(db,{kind:'utility',date:'2026-10-08',shift:'Night',airPressure:7});assert.equal(db.energyRecords.length,3);assert.equal(utilityParameters.length,7);
 for(const v of [{waterLevel:101},{upsAlarm:2},{airPressure:-1},{pumpState:'Unknown'}])assert.throws(()=>saveEnergyRecord(db,{kind:'utility',date:'2026-10-08',shift:'Day',...v}));
 assert.throws(()=>saveEnergyRecord(db,{kind:'energy',date:'2026-02-29',electricity:1}));assert.throws(()=>saveEnergyRecord(db,{kind:'energy',date:'2026-10-08'}));
 assert.equal(workspaceForRole(db,{role:'Employee'}).energyRecords.length,0);assert.equal(workspaceForRole(db,{role:'Production Responsible'}).energyRecords.length,0);assert.equal(workspaceForRole(db,{role:'HSE'}).energyRecords.length,3);
 for(const role of ['Employee','Production Responsible','HSE','Purchasing Department','Viewer']){db.role=role;assert.throws(()=>saveEnergyRecord(db,{kind:'energy',date:'2026-10-08',electricity:1}),/role/);}
 assert.equal(canSeePage('Viewer','Energy'),true);assert.equal(canSeePage('Employee','Energy'),false);
});
