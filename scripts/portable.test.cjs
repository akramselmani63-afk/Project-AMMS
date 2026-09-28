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
  const workspace = vm.runInContext('workflow.seed()', context);
  workspace.partRequests.push({ id: 'SP-TEST', title: 'Test part', equipmentId: workspace.equipment[0].id, status: 'Purchasing', reference: 'REF-1', quantity: 1, unit: 'pcs', acceptedQuantity: 0, rejectedQuantity: 0, deliveries: [], photos: [] });
  saved = JSON.stringify(workspace);
  await new Promise(resolve => setImmediate(resolve));

  const click = async (attribute, value) => listeners.click({ target: { closest: selector => selector === `[${attribute}]` ? { dataset: { [attribute === 'data-page' ? 'page' : attribute === 'data-report-tab' ? 'reportTab' : 'action']: value, id: value } } : null } });
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
  await open('Work', 'open', 'workOrders');
  await open('Parts', 'open', 'partRequests');
  await open('Preventive', 'open', 'preventive');
  await open('Reports', 'open-report-intervention', 'workOrders');
  await click('data-page', 'Reports');
  await click('data-report-tab', 'shift');
  const shift = app.innerHTML.match(/data-action="open" data-id="reports:([^"]+)"/)?.[1];
  assert.ok(shift, 'shift report has an Open button');
  await listeners.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'open', id: `reports:${shift}` } } : null } });
  assert.match(app.innerHTML, /record-navigation/, 'shift report opens its detail');
});

