const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const vm = require('node:vm');

test('portable file opens records from every list', async () => {
  const root = resolve(__dirname, '..');
  execFileSync(process.execPath, ['scripts/portable.js'], { cwd: root });
  const html = readFileSync(resolve(root, 'AMMS-Access-Preview.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const listeners = {};
  const app = { innerHTML: '', removeAttribute() {} };
  const document = {
    documentElement: {}, body: { classList: { toggle() {} } },
    querySelector: selector => selector === '#app' ? app : null,
    addEventListener: (name, handler) => { listeners[name] = handler; }
  };
  let saved;
  const context = vm.createContext({
    document, performance: { now: () => 0 }, setTimeout() {},
    sessionStorage: { getItem: () => '1' },
    localStorage: { getItem: () => saved },
    indexedDB: { open() { throw Error('Unavailable in this test'); } },
    console: { warn() {} }, structuredClone
  });
  vm.runInContext(script, context);
  const workspace = vm.runInContext('workflow.seed({examples:true})', context);
  workspace.actor = 'Akram Selmani';
  context.workspace = workspace;
  vm.runInContext('workflow.generatePM(workspace, workspace.preventive[0].id)', context);
  workspace.partRequests.push({ id: 'SP-TEST', title: 'Test part', equipmentId: workspace.equipment[0].id, status: 'Purchasing', reference: 'REF-1', quantity: 1, unit: 'pcs', acceptedQuantity: 0, rejectedQuantity: 0, deliveries: [], photos: [] });
  saved = JSON.stringify(workspace);
  await new Promise(resolve => setImmediate(resolve));
  const orphanWork = workspace.workOrders.filter(w => !workspace.requests.some(r => r.id === w.requestId));
  const openCount = workspace.requests.filter(r => !['Closed','Legacy completed','Rejected'].includes(workspace.workOrders.find(w => w.requestId === r.id)?.status || r.status)).length + orphanWork.filter(w => !['Closed','Legacy completed','Rejected'].includes(w.status)).length;
  const allCount = workspace.requests.length + orphanWork.length;
  assert.match(app.innerHTML, /class="priority-donut" style="background:conic-gradient\(/, 'overview renders the priority circle');
  assert.match(app.innerHTML, new RegExp(`class="priority-donut-center"><strong>${openCount}</strong>`), 'open circle includes new and preventive interventions');
  await listeners.click({ target: { closest: selector => selector === '[data-priority-scope]' ? { dataset: { priorityScope: 'all' } } : null } });
  assert.match(app.innerHTML, new RegExp(`class="priority-donut-center"><strong>${allCount}</strong>`), 'all circle includes closed interventions');

  const click = async (attribute, value) => listeners.click({ target: { closest: selector => selector === `[${attribute}]` ? { dataset: { [attribute === 'data-page' ? 'page' : attribute === 'data-report-tab' ? 'reportTab' : 'action']: value, id: value } } : null } });
  assert.match(app.innerHTML,/data-page="KPI"/, 'KPI statistics has a sliding-menu entry');
  assert.doesNotMatch(app.innerHTML,/id="kpi-section"/, 'overview keeps KPI statistics on its own page');
  await click('data-page','KPI');
  assert.match(app.innerHTML,/id="kpi-section"/, 'sliding-menu entry opens the KPI page');
  assert.match(app.innerHTML,/<h1 id="kpi-title">/, 'KPI page has its own title');
  for(const name of ['MTTR']) assert.ok(app.innerHTML.includes(name));
  assert.ok(!app.innerHTML.includes('<strong>MTTF</strong>'));
  await click('data-action','cancel');
  await click('data-page','Notifications');
  assert.match(app.innerHTML,/class="notification-button"[\s\S]*?<button class="role-chip"/, 'notification bell is beside the profile');
  assert.match(app.innerHTML,/class="notification-count"/, 'pending actions have a count badge');
  assert.match(app.innerHTML,/popovertarget="notification-drawer"/, 'bell targets the floating drawer');
  assert.match(app.innerHTML,/id="notification-drawer"[^>]*popover="auto"/, 'drawer has native outside-click and Escape dismissal');
  assert.match(app.innerHTML,/popovertargetaction="hide"/, 'drawer has a close button');
  assert.doesNotMatch(app.innerHTML,/<button class="nav-item[^>]*data-page="Notifications"/, 'notification entry moved out of the sidebar');
  assert.match(app.innerHTML,/notification-list/, 'notification history opens');
  assert.match(app.innerHTML,/data-filter="Pending"/, 'notifications expose pending reminders');
  await click('data-page','Inventory');
  await click('data-action','new-stock');
  assert.match(app.innerHTML,/name="reference"/, 'stock item form has a reference');
  assert.match(app.innerHTML,/name="minimum"/, 'stock item form has a minimum level');
  await click('data-action','cancel');
  await click('data-page','Equipment');
  assert.match(app.innerHTML,/data-action="edit-equipment"/, 'equipment register has Modify buttons');
  await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'edit-equipment', id: workspace.equipment[0].id } } : null } });
  assert.match(app.innerHTML,/name="reference"/, 'equipment edit form has a reference');
  assert.match(app.innerHTML,/name="parentId"/, 'equipment edit form keeps hierarchy');
  await click('data-action','cancel');
  const open = async (page, action, collection) => {
    await click('data-page', page);
    const id = app.innerHTML.match(new RegExp(`data-action="${action}" data-id="${collection}:([^"]+)"`))?.[1];
    assert.ok(id, `${page} has an Open button`);
    await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action, id: `${collection}:${id}` } } : null } });
    assert.match(app.innerHTML, /record-navigation/, `${page} opens its detail`);
  };
  await open('Overview', 'open', 'workOrders');
  await open('Equipment', 'open', 'workOrders');
  await open('Requests', 'open', 'requests');
  await click('data-page', 'Requests');
  assert.match(app.innerHTML, /data-record-filter="equipment"/, 'interventions filter by equipment');
  assert.match(app.innerHTML, /data-record-filter="origin"/, 'interventions filter by source');
  await open('Parts', 'open', 'partRequests');
  await click('data-page', 'Parts');
  assert.match(app.innerHTML, /data-record-filter="priority"/, 'parts filter by priority');
  await open('Preventive', 'open', 'preventive');
  await open('Reports', 'open-report-intervention', 'workOrders');
  await click('data-page', 'Reports');
  assert.match(app.innerHTML, /data-record-filter="date"/, 'reports filter by date');
  await click('data-report-tab', 'shift');
  const shift = app.innerHTML.match(/data-action="open" data-id="reports:([^"]+)"/)?.[1];
  assert.ok(shift, 'shift report has an Open button');
  await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'open', id: `reports:${shift}` } } : null } });
  assert.match(app.innerHTML, /record-navigation/, 'shift report opens its detail');
  await click('data-page', 'Requests');
  assert.doesNotMatch(app.innerHTML, /data-page="Work"/, 'interventions have one navigation area');
  const linked = workspace.requests.find(r => workspace.workOrders.some(w => w.requestId === r.id));
  await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'open', id: `requests:${linked.id}` } } : null } });
  assert.match(app.innerHTML, /data-action="profile-role"/, 'assigned team appears on the intervention');
  await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'profile-role', id: 'Maintenance Engineer' } } : null } });
  assert.match(app.innerHTML, /profile-hero/, 'facepile opens a role profile');
  await click('data-page', 'Requests');
  await click('data-page', 'Profile');
  assert.match(app.innerHTML, /profile-avatar">AS<\/span>/, 'profile uses first and last name initials');
  assert.doesNotMatch(app.innerHTML, /Ordres de travail affectés à ce rôle/, 'profile omits work orders');
});

test('access preview hides restricted routes, direct records and private KPI fields',async()=>{
 const {seed}=await import('../src/workflow.js');const html=readFileSync('AMMS-Access-Preview.html','utf8');const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 for(const role of ['Employee','Production Responsible','HSE','Purchasing Department','Maintenance Responsible','Viewer']){
  const workspace=seed({examples:true});workspace.role=role;workspace.actor='Alice';workspace.requests[0].reportedBy='Alice';
  const app={innerHTML:'',removeAttribute(){}};const listeners={};const saved=JSON.stringify(workspace);
  const context=vm.createContext({document:{documentElement:{},body:{classList:{toggle(){}}},querySelector:s=>s==='#app'?app:null,addEventListener:(n,h)=>listeners[n]=h},performance:{now:()=>0},setTimeout(){},sessionStorage:{getItem:()=> '1'},localStorage:{getItem:()=>saved},indexedDB:{open(){throw Error('Unavailable')}},console:{warn(){}},structuredClone});
  vm.runInContext(script,context);await new Promise(r=>setImmediate(r));assert.match(app.innerHTML,/ACCESS PREVIEW|APERÇU DES ACCÈS/);
  const click=(page)=>listeners.click({target:{closest:s=>s==='[data-page]'?{dataset:{page}}:null}});
  await click('KPI');if(!['Employee','Production Responsible'].includes(role)) assert.match(app.innerHTML,/KPI/);
  if(role==='Employee'){assert.doesNotMatch(app.innerHTML,/data-page="Parts"|MTTR/);await click('Parts');assert.doesNotMatch(app.innerHTML,/data-page="Parts"/);await listeners.click({target:{closest:s=>s==='[data-action]'?{dataset:{action:'open',id:'partRequests:PRIVATE'}}:null}});assert.match(app.innerHTML,/Mon historique d’interventions|My intervention history/);}
  if(role==='HSE') assert.doesNotMatch(app.innerHTML,/MTTR|Recorded downtime/);
  if(role==='Purchasing Department') assert.match(app.innerHTML,/Livraisons en retard|Late deliveries/);
 }
});
