import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const read = path => readFile(resolve(root, path), 'utf8');
const source = async (path, imports, names) => {
  const code = (await read(path))
    .replace(/^import .*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return `(() => {\n${imports}\n${code}\nreturn {${names.join(',')}};\n})()`;
};

const logo = `data:image/png;base64,${(await readFile(resolve(root, 'assets/agridiam-logo.png'))).toString('base64')}`;
const assets = await source('src/source-assets.js', '', ['sourceTitle', 'sourceEquipment']);
const data = await source('src/data.js', 'const {sourceEquipment} = assets;', ['STORAGE_KEY', 'seed', 'load', 'save', 'nextId', 'equipmentPath']);
const workflow = await source('src/workflow.js', 'const {load: loadBase, seed: seedBase, nextId} = data;', [
  'roles', 'rights', 'can', 'today', 'localDay', 'elapsedMinutes', 'audit', 'migrate', 'canReviewRequest', 'seed', 'load',
  'addRequest', 'assess', 'reviewRequest', 'createWork', 'issueWork', 'submitSiteRiskAssessment',
  'partsPending', 'updateWork', 'addPartRequest', 'updatePart', 'addEquipment', 'addPM',
  'generatePM', 'addReport', 'inEquipmentScope', 'reportActivities', 'interventionReports', 'approveReport', 'statusMatches'
]);
const photos = await source('src/photos.js', '', ['MAX_PHOTOS', 'validatePhotos', 'readPhotos']);
const indexed = await source('src/storage.js', 'const {load, migrate} = workflow;', ['readWorkspace', 'writeWorkspace']);
let app = (await read('src/app.js'))
  .replace(/^import .*?;\r?\n/gm, '')
  .replaceAll('./assets/agridiam-logo.png', logo);

const storage = `
const storage = (() => {
  const key = 'amms-portable-workspace-v1';
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

const script = `const assets = ${assets};\nconst data = ${data};\nconst workflow = ${workflow};\nconst photosModule = ${photos};\nconst indexed = ${indexed};\n${storage}\n(async () => {\nconst flow = workflow;\nconst {equipmentPath} = data;\nconst {readWorkspace, writeWorkspace} = storage;\nconst {readPhotos} = photosModule;\n${app}\n})();`;
const css = (await read('styles.css')).replaceAll("./assets/agridiam-logo.png", logo);
const startup = `const showStartupError = event => { const app = document.getElementById('app'); if (app && !app.querySelector('.shell')) { const message = event.reason?.message || event.message || 'Unknown startup error'; app.innerHTML = '<main style="font:16px Arial,sans-serif;padding:32px;max-width:700px"><h1>AMMS could not open / AMMS ne peut pas démarrer</h1><p>' + String(message).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</p></main>'; } }; window.addEventListener('error', showStartupError); window.addEventListener('unhandledrejection', showStartupError);`;
const html = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="theme-color" content="#152c35">\n<title>AMMS · AGRIDIAM Maintenance Management System</title>\n<style>${css}</style>\n</head>\n<body>\n<div id="app"><main style="font:16px Arial,sans-serif;padding:32px">Opening AMMS… / Ouverture d’AMMS…</main></div>\n<script>${startup}</script>\n<script>${script.replaceAll('</script', '<\\/script')}</script>\n</body>\n</html>\n`;
const output = resolve(root, 'AMMS-Prototype.html');
await writeFile(output, html);
console.log(`Created ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);

