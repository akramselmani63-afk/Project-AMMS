import test from 'node:test';import assert from 'node:assert/strict';import {equipmentFailureTrend} from './statistics.js';
test('equipment trend splits days in Algeria time, merges overlaps and converts yearly hours to days',()=>{
 const db={requests:[{id:'A',equipmentId:'E',impact:'Running with a fault',createdAt:'2026-01-01T22:00:00Z',status:'Closed'},{id:'S',equipmentId:'E',impact:'Equipment stopped',createdAt:'2026-01-01T23:00:00Z',status:'Closed'},{id:'OTHER',equipmentId:'OTHER',impact:'Equipment stopped',createdAt:'2026-01-01T22:00:00Z',status:'Submitted'}],workOrders:[{requestId:'A',completedAt:'2026-01-02T02:00:00Z'},{requestId:'S',completedAt:'2026-01-02T01:00:00Z'}]};
 const now=new Date('2026-02-01T00:00:00Z'),daily=equipmentFailureTrend(db,'E','2026-01',false,now);
 assert.equal(daily.length,31);assert.equal(daily[0].anomaly,1);assert.equal(daily[1].stopped,2);assert.equal(daily[1].anomaly,1);
 db.requests.push({...db.requests[1],id:'DUPLICATE'});db.workOrders.push({requestId:'DUPLICATE',completedAt:'2026-01-02T01:00:00Z'});
 assert.equal(equipmentFailureTrend(db,'E','2026-01',false,now)[1].stopped,2);
 const yearly=equipmentFailureTrend(db,'E','2026-01',true,now);assert.equal(yearly.length,12);assert.equal(yearly[0].stopped,2/24);assert.equal(yearly[0].anomaly,2/24);
 assert.equal(equipmentFailureTrend(db,'E','2026-02',false,now).length,28);
});
