import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import './build-notifications.js';

const root = resolve('.');
const read = path => readFile(resolve(root, path), 'utf8');
const source = async (path, imports, names) => {
  const code = (await read(path))
    .replace(/^import .*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return `(() => {\n${imports}\n${code}\nreturn {${names.join(',')}};\n})()`;
};

const image = async path => {
  try { return await readFile(resolve(root, path)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const encoded = await read(`${path}.b64`).catch(async () =>
      (await read(`${path}.b64.1`)) + (await read(`${path}.b64.2`))
    );
    return Buffer.from(encoded.trim(), 'base64');
  }
};
const logo = `data:image/png;base64,${(await image('assets/agridiam-logo.png')).toString('base64')}`;
const appIcon = `data:image/png;base64,${(await image('assets/amms-app-icon-green-a.png')).toString('base64')}`;
const openingLogo = `data:image/png;base64,${(await image('assets/amms-logo-monitoring.png')).toString('base64')}`;
const assets = await source('src/source-assets.js', '', ['sourceTitle', 'sourceEquipment']);
const data = await source('src/data.js', 'const {sourceEquipment} = assets;', ['STORAGE_KEY', 'seed', 'load', 'save', 'nextId', 'equipmentPath', 'sortedEquipment']);
const workflow = await source('src/workflow.js', 'const {load: loadBase, seed: seedBase, nextId} = data;', [
  'roles', 'rights', 'can', 'today', 'localDay', 'elapsedMinutes', 'audit', 'migrate', 'canReviewRequest', 'safetyReviewer', 'seed', 'load',
  'addRequest', 'canRemoveIntervention', 'removeIntervention', 'assess', 'reviewRequest', 'createWork', 'issueWork', 'submitSiteRiskAssessment',
  'partsPending', 'updateWork', 'addPartRequest', 'updatePart', 'addEquipment', 'editEquipment', 'addStock', 'moveStock', 'stockBalance', 'notificationFeed', 'recordReliability', 'recordCounter', 'syncEquipmentStates', 'addPM',
  'generatePM', 'addReport', 'inEquipmentScope', 'reportActivities', 'interventionReports', 'approveReport', 'interventionProgressStep', 'statusMatches'
]);
const commands = await source('src/commands.js', 'const flow = workflow;\nconst {canSeePage,workspaceForRole} = access;', ['applyCommand','recordIds','assignCreated','newRecordIds']);
const statistics = await source('src/statistics.js', 'const {inEquipmentScope,localDay} = workflow;', ['maintenanceStats','equipmentFailureTrend']);
const access = await source('src/access.js', 'const {maintenanceStats,equipmentFailureTrend} = statistics; const {safetyReviewer,canReviewRequest} = workflow;', ['rolePages','canSeePage','workspaceForRole']);
const photos = await source('src/photos.js', '', ['MAX_PHOTOS', 'validatePhotos', 'readPhotos', 'readProforma']);
const indexed = await source('src/storage.js', 'const {load, migrate} = workflow;', ['readWorkspace', 'writeWorkspace','readServerCache','writeServerCache']);
let app = (await read('src/app.js'))
  .replace(/^import .*?;\r?\n/gm, '')
  .replaceAll('./assets/agridiam-logo.png', logo)
  .replaceAll('./assets/amms-app-icon-green-a.png', appIcon)
  .replaceAll('./assets/amms-logo-monitoring.png', openingLogo);

const storage = `
const storage = (() => {
  const key = 'amms-access-preview-portable-workspace-v1';
  let fallback = false;
  let memory;
  async function readWorkspace() {
    if (!fallback) {
      try { return await indexed.readWorkspace(); }
      catch (error) {
        // Local file browser origins can reject IndexedDB or legacy localStorage reads.
        // Keep the saved IndexedDB database untouched and use the portable fallback.
        console.warn('AMMS portable storage fallback:', error);
        fallback = true;
      }
    }
    try {
      const saved = localStorage.getItem(key);
      if (saved) return workflow.migrate(JSON.parse(saved));
    } catch (error) { console.warn('AMMS local storage unavailable:', error); }
    return memory ? structuredClone(memory) : workflow.seed();
  }
  async function writeWorkspace(value) {
    if (!fallback) return indexed.writeWorkspace(value);
    value.revision = (value.revision || 0) + 1;
    memory = structuredClone(value);
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) {
      if (error?.name !== 'SecurityError') throw error;
    }
  }
  return {readWorkspace, writeWorkspace};
})();`;

const script = `const assets = ${assets};\nconst data = ${data};\nconst workflow = ${workflow};\nconst statistics = ${statistics};\nconst access = ${access};\nconst commandsModule = ${commands};\nconst photosModule = ${photos};\nconst indexed = ${indexed};\n${storage}\n(async () => {\nconst flow = workflow;\nconst {maintenanceStats,equipmentFailureTrend} = statistics;\nconst {applyCommand,recordIds,assignCreated,newRecordIds} = commandsModule;\nconst {equipmentPath, sortedEquipment} = data;\nconst {readWorkspace, writeWorkspace} = storage;\nconst {readServerCache,writeServerCache} = indexed;\nconst {readPhotos,readProforma} = photosModule;\nconst {canSeePage,workspaceForRole}=access;\n${app}\n})();`;
const notifications = await read('assets/notifications.js');
const css = (await read('assets/notifications.css')) + (await read('styles.css')).replaceAll("./assets/agridiam-logo.png", logo);
const startup = `const showStartupError = event => { const app = document.getElementById('app'); if (app && !app.querySelector('.shell')) { const message = event.reason?.message || event.message || 'Unknown startup error'; app.innerHTML = '<main style="font:16px Arial,sans-serif;padding:32px;max-width:700px"><h1>AMMS could not open / AMMS ne peut pas démarrer</h1><p>' + String(message).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</p></main>'; app.removeAttribute('inert'); document.getElementById('splash')?.remove(); } }; window.addEventListener('error', showStartupError); window.addEventListener('unhandledrejection', showStartupError);`;
const html = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="theme-color" content="#152c35">\n<title>AMMS ACCESS PREVIEW · AGRIDIAM Maintenance Management System</title>\n<link rel="icon" type="image/png" href="${appIcon}">\n<style>${css}</style>\n</head>\n<body>\n<div id="splash" class="splash" role="status" aria-label="Opening AMMS / Ouverture d’AMMS"><div class="splash-content"><img class="splash-logo" src="${openingLogo}" alt="AMMS · AGRIDIAM Maintenance Monitoring System"><div class="splash-credit"><span>BY</span><img src="${logo}" alt="AGRIDIAM"></div></div></div>\n<div id="app" inert></div>\n<script>${startup}</script>\n<script>${notifications.replaceAll('</script', '<\\/script')}</script>\n<script>${script.replaceAll('</script', '<\\/script')}</script>\n</body>\n</html>\n`;
const output = resolve(root, 'AMMS-Access-Preview.html');
await writeFile(output, html);
console.log(`Created ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
