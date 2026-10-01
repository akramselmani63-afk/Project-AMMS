const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const vm = require('node:vm');

test('portable file opens records from every list', async () => {
  const root = resolve(__dirname, '..');
  execFileSync(process.execPath, ['scripts/portable.js'], { cwd: root });
  const html = readFileSync(resolve(root, 'AMMS-Prototype.html'), 'utf8');
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
  await click('data-action','toggle-kpis');
  assert.match(app.innerHTML,/id="kpi-section"/, 'portable overview opens KPI statistics');
  for(const name of ['MTTR','MTBF','MTBM','MTTF']) assert.ok(app.innerHTML.includes(name));
  await click('data-action','record-reliability');
  assert.match(app.innerHTML,/name="operatingHours"/, 'portable measurements form uses shared workflow');
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
