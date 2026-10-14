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

test('supplied generator and electrical register stores cumulative indexes without summing or overwriting legacy readings',()=>{
 const db=seed();db.role='Maintenance Engineer';saveEnergyRecord(db,{kind:'energy',date:'2026-10-08',electricity:12});
 const r=saveEnergyRecord(db,{kind:'meter',date:'2026-10-08',generatorHours:401.4,generatorStarts:605,generatorEmergencyStops:0,generatorActive:10160,screen1active:9745.68,meterTotal:954498,meterPreviousTotal:953408,generatorMaintenance:9608});
 assert.equal(r.values.generatorEmergencyStops,0);assert.equal(r.values.meterTotal,954498);assert.equal(db.energyRecords[0].values.electricity,12);
 saveEnergyRecord(db,{kind:'meter',date:'2026-10-09',generatorMaintenance:9606,generatorActive:10293});assert.equal(db.energyRecords.length,3);
 assert.throws(()=>saveEnergyRecord(db,{kind:'meter',date:'2026-10-08',generatorStarts:1.5}),/whole numbers/);
});

test('clearing the last saved reading keeps its record and audit history',()=>{
 const db=seed();db.role='Maintenance Engineer';const r=saveEnergyRecord(db,{kind:'meter',date:'2026-10-08',generatorHours:1});
 saveEnergyRecord(db,{kind:'meter',date:'2026-10-08',generatorHours:'',clearEmpty:true});assert.deepEqual(r.values,{});assert.equal(r.history.length,2);assert.equal(db.energyRecords.length,1);
 assert.throws(()=>saveEnergyRecord(db,{kind:'meter',date:'2026-10-09',clearEmpty:true}),/at least one/);
});
