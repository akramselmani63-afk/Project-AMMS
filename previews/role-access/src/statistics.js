import { inEquipmentScope, localDay } from './workflow.js';

// Counts linked requests and work once. Operating hours come from verified readings,
// never from calendar time or the number of records in the app.
export function maintenanceStats(db, { days=30, equipmentId='', now=new Date() }={}) {
  const today=localDay(now.toISOString());
  const start=new Date(now); start.setDate(start.getDate()-(days-1));
  const from=days?localDay(start.toISOString()):'';
  const within=value=>{const day=localDay(value); return day && (!from || day>=from) && day<=today;};
  const scoped=item=>inEquipmentScope(db,item.equipmentId,equipmentId);
  const created=item=>item.createdAt || item.history?.[0]?.at;
  const linked=new Set();
  const interventions=(db.requests || []).map(request=>{
    const work=db.workOrders.find(w=>w.requestId===request.id);
    if(work) linked.add(work.id);
    return {...request,status:work?.status || request.status};
  }).concat(db.workOrders.filter(w=>!linked.has(w.id))).filter(scoped);
  const closed=item=>['Closed','Legacy completed','Completed'].includes(item.status);
  const cohort=interventions.filter(r=>r.status!=='Rejected' && within(created(r)));
  const open=interventions.filter(r=>!closed(r) && r.status!=='Rejected');
  const ageCutoff=new Date(now); ageCutoff.setDate(ageCutoff.getDate()-7);
  const completed=db.workOrders.filter(w=>closed(w) && within(w.completedAt) && scoped(w));
  const duration=work=>{
    if(!work.startedAt || !work.completedAt) return null;
    const hours=(new Date(work.completedAt)-new Date(work.startedAt))/3_600_000;
    return Number.isFinite(hours) && hours>=0?hours:null;
  };
  const repairs=completed.filter(w=>w.type!=='Preventive' && !w.pmId).map(duration).filter(h=>h!==null);
  const byEquipment=new Map();
  let downtimeHours=0, missingTimes=0;
  for(const work of completed) {
    const hours=duration(work);
    if(hours===null) { missingTimes++; continue; }
    downtimeHours+=hours;
    byEquipment.set(work.equipmentId,(byEquipment.get(work.equipmentId) || 0)+hours);
  }
  const logs=[]; let partialLogs=0;
  const scopeKind=db.equipment.find(e=>e.id===equipmentId)?.kind;
  const exactAsset=['Machine','Component'].includes(scopeKind);
  for(const equipment of db.equipment.filter(e=>exactAsset?e.id===equipmentId:scoped({equipmentId:e.id}))) {
    for(const log of equipment.reliabilityLog || []) {
      if((!from || log.startDate>=from) && log.endDate<=today) logs.push({...log,equipmentId:equipment.id});
      else if(log.startDate<=today && (!from || log.endDate>=from)) partialLogs++;
    }
  }
  const sum=key=>logs.reduce((total,log)=>total+(Number(log[key]) || 0),0);
  const operatingHours=sum('operatingHours'), failureCount=sum('failureCount'), maintenanceCount=sum('maintenanceCount'), failedUnitCount=sum('failedUnitCount');
  return {
    from,today,cohortCount:cohort.length,completionRate:cohort.length?cohort.filter(closed).length/cohort.length*100:null,
    completedCount:completed.length,openCount:open.length,
    agedCount:open.filter(r=>created(r) && new Date(created(r))<=ageCutoff).length,
    approvals:open.filter(r=>['Approval review','Responsible review','HSE review','Awaiting approval','Awaiting risk assessment','Site risk assessment'].includes(r.status)).length,
    overduePM:db.preventive.filter(p=>scoped(p) && p.nextDue<today).length,
    outstandingParts:db.partRequests.filter(p=>scoped(p) && !['Closed','Rejected','Accepted'].includes(p.status)).length,
    downtimeHours,missingTimes,repairSamples:repairs.length,mttr:repairs.length?repairs.reduce((a,b)=>a+b,0)/repairs.length:null,
    operatingHours,failureCount,maintenanceCount,failedUnitCount,
    mtbf:operatingHours>0 && failureCount>0?operatingHours/failureCount:null,
    mtbm:operatingHours>0 && maintenanceCount>0?operatingHours/maintenanceCount:null,
    mttf:failedUnitCount>0?sum('failedUnitHours')/failedUnitCount:null,
    logs,partialLogs,topDowntime:[...byEquipment].sort((a,b)=>b[1]-a[1]).slice(0,5)
  };
}

// AGRIDIAM calendar uses Algeria time (UTC+1); overlapping reports count once.
export function equipmentFailureTrend(db,equipmentId,period,annual=false,now=new Date()) {
 const year=Number(period.slice(0,4)),month=annual?0:Number(period.slice(5,7))-1;
 if(!Number.isInteger(year) || year<2000 || year>2200 || !Number.isInteger(month) || month<0 || month>11) return [];
 const boundary=(m,d=1)=>Date.UTC(year,m,d)-3600000;
 const intervals=db.requests.filter(r=>(!equipmentId || r.equipmentId===equipmentId || inEquipmentScope(db,r.equipmentId,equipmentId)) && ['Equipment stopped','Équipement arrêté','Running with a fault','Fonctionne avec anomalie'].includes(r.impact)).flatMap(r=>{
  const start=Date.parse(r.createdAt),work=db.workOrders.find(w=>w.requestId===r.id);
  const closed=['Closed','Legacy completed'].includes(r.status) || work?.status==='Closed';
  const end=closed?Date.parse(work?.completedAt || (r.history || []).findLast(h=>['Closed','Closed with work order'].includes(h.action))?.at):now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end>start?[{equipmentId:r.equipmentId,start,end:Math.min(end,now.getTime()),stopped:['Equipment stopped','Équipement arrêté'].includes(r.impact)}]:[];
 });
 const count=annual?12:new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return Array.from({length:count},(_,i)=>{
  const start=annual?boundary(i):boundary(month,i+1),end=annual?boundary(i+1):boundary(month,i+2);
  const clips=intervals.filter(r=>r.start<end && r.end>start).map(r=>({...r,start:Math.max(start,r.start),end:Math.min(end,r.end)}));
  const points=[...new Set(clips.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b);let stopped=0,anomaly=0;
  for(let j=1;j<points.length;j++) {const active=clips.filter(r=>r.start<points[j] && r.end>points[j-1]);const duration=(points[j]-points[j-1])/3600000;for(const id of new Set(active.map(r=>r.equipmentId))) {const records=active.filter(r=>r.equipmentId===id);if(records.some(r=>r.stopped)) stopped+=duration;else anomaly+=duration;}}
  return {label:i+1,stopped:stopped/(annual?24:1),anomaly:anomaly/(annual?24:1)};
 });
}
