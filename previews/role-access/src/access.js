import {maintenanceStats} from './statistics.js';

export const rolePages={
  Employee:['Overview','KPI','Equipment','Requests','Preventive','Notifications','Profile'],
  'Maintenance Engineer':['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile'],
  'Maintenance Responsible':['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile'],
  HSE:['Overview','KPI','Equipment','Requests','Notifications','Profile'],
  'Purchasing Department':['Overview','KPI','Equipment','Parts','Inventory','Notifications','Profile'],
  Viewer:['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile']
};
export const canSeePage=(role,page)=>(rolePages[role] || []).includes(page);
const pick=(item,fields)=>Object.fromEntries(fields.filter(key=>key in item).map(key=>[key,item[key]]));
const equipmentFields=['id','name','parentId','kind','reference','status','criticality','description','source','sourceCell'];
const requestFields=['id','title','equipmentId','description','status','priority','reportedBy','reportedRole','reportedEmail','createdAt','createdBy','photos'];
const workFields=['id','requestId','title','equipmentId','priority','status','dueDate','startedAt','completedAt','downtimeMinutes','type','pmId'];
export function workspaceForRole(workspace,user) {
  if(workspace.accessProjection) return workspace;
  const {appliedCommands,...result}=workspace;
  result.role=user.role;result.actor=user.name;result.actorEmail=user.email;result.accessProjection=true;
  if(['Maintenance Engineer','Maintenance Responsible','Viewer'].includes(user.role)) return result;
  result.publicKpis=Object.fromEntries([7,30,90,0].map(days=>{
    const stats=maintenanceStats(workspace,{days});
    const safe=pick(stats,user.role==='HSE'?['from','today','completedCount']:['from','today','completionRate','completedCount','downtimeHours','overduePM']);
    if(user.role==='Employee') safe.preventiveCompleted=workspace.workOrders.filter(w=>w.status==='Closed' && (w.type==='Preventive' || w.pmId) && w.completedAt && (!stats.from || w.completedAt.slice(0,10)>=stats.from) && w.completedAt.slice(0,10)<=stats.today).length;
    return [days,safe];
  }));
  result.equipment=workspace.equipment.map(e=>pick(e,equipmentFields));
  result.documents=[];result.parts=[];result.reports=[];
  if(user.role==='Employee') {
    result.requests=workspace.requests.filter(r=>user.email?r.reportedEmail===user.email:r.reportedBy===user.name).map(r=>({...pick(r,requestFields),risks:[],history:(r.history || []).filter(h=>['Submitted','Returned','Rejected','Closed','Closed with work order'].includes(h.action)).map(h=>pick(h,['at','action']))}));
    const ids=new Set(result.requests.map(r=>r.id));
    result.workOrders=workspace.workOrders.filter(w=>ids.has(w.requestId)).map(w=>({...pick(w,workFields),participants:[],history:[]}));
    result.preventive=workspace.preventive.map(p=>pick(p,['id','title','equipmentId','intervalDays','nextDue']));
    result.partRequests=[];result.inventory=[];
  } else if(user.role==='HSE') {
    result.partRequests=[];result.inventory=[];result.preventive=[];
  } else if(user.role==='Purchasing Department') {
    result.requests=[];result.workOrders=[];result.preventive=[];
    result.publicKpis={};
  } else {
    result.requests=[];result.workOrders=[];result.preventive=[];result.partRequests=[];result.inventory=[];result.publicKpis={};
  }
  return result;
}
