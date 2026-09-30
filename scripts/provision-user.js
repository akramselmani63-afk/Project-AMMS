import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { roles } from '../src/workflow.js';

const [address,name,role]=process.argv.slice(2);
const domain=String(process.env.AMMS_EMAIL_DOMAIN || '').toLowerCase().replace(/^@/,'');
if(!domain || !address?.toLowerCase().endsWith(`@${domain}`) || !name?.trim() || !roles.includes(role)) {
  console.error('Usage: set AMMS_EMAIL_DOMAIN, then node scripts/provision-user.js email@domain "Full Name" "Employee|Maintenance Engineer|Maintenance Responsible|HSE|Purchasing Department|Viewer"');
  process.exit(1);
}
const directory=resolve(process.env.AMMS_DATA_DIR || join(homedir(),'Documents','AMMS-Server'));
await mkdir(directory,{recursive:true});
const target=join(directory,'users.json');
let users={};try { users=JSON.parse(await readFile(target,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; }
const key=address.toLowerCase();
users[key]={...users[key],name:name.trim(),role};
let invite;
if(!users[key].hash) { invite=randomBytes(16).toString('hex'); users[key].inviteHash=createHash('sha256').update(invite).digest('hex'); }
const temp=join(directory,`.users-${randomBytes(8).toString('hex')}.tmp`);
await writeFile(temp,JSON.stringify(users),'utf8');await rename(temp,target);
console.log(`${key} provisioned as ${role}.`);
if(invite) console.log(`Give this one-time activation code privately to the user: ${invite}`);
