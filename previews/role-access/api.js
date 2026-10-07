import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { seed, migrate, roles } from './src/workflow.js';
import {workspaceForRole} from './src/access.js';
import { applyCommand, recordIds, assignCreated } from './src/commands.js';

const scrypt=promisify(scryptCallback);
const dataDir=resolve(process.env.AMMS_ACCESS_DATA_DIR || join(homedir(),'Documents','AMMS-Access-Server'));
const domain=String(process.env.AMMS_ACCESS_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/,'');
const adminToken=String(process.env.AMMS_ACCESS_ADMIN_TOKEN || '');
if (!domain) throw new Error('Set AMMS_ACCESS_EMAIL_DOMAIN before starting server mode.');
const sessions=new Map();
const failed=new Map();
const failedAdmin=new Map();
let pending=Promise.resolve();
const serial=fn=>{const result=pending.then(fn);pending=result.catch(()=>{});return result;};
const send=(res,status,data,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(data));};
const file=name=>join(dataDir,name);
async function read(name,fallback) { try { return JSON.parse(await readFile(file(name),'utf8')); } catch(e) { if(e.code==='ENOENT') return fallback; throw e; } }
async function save(name,value) {
  await mkdir(dataDir,{recursive:true});
  const temp=file(`.${name}.${randomBytes(8).toString('hex')}.tmp`);
  await writeFile(temp,JSON.stringify(value),'utf8');
  await rename(temp,file(name));
}
async function body(req) {
  let size=0,chunks=[];
  for await(const chunk of req) { size+=chunk.length; if(size>32*1024*1024) throw Object.assign(new Error('Request too large.'),{status:413}); chunks.push(chunk); }
  try { const value=JSON.parse(Buffer.concat(chunks).toString('utf8')); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw Object.assign(new Error('Invalid JSON object.'),{status:400}); }
}
const email=value=>String(value || '').trim().toLowerCase();
const personName=person=>[person?.name,person?.surname].filter(Boolean).join(' ') || person?.name || '';
const activeRole=role=>role==='Developer Admin'?'Viewer':role;
const validEmail=value=>value.endsWith(`@${domain}`) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const cookie=req=>String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('amms_access_session='))?.slice(20);
function userFor(req,users) {
  const token=cookie(req),session=token && sessions.get(token);
  if(!session || session.expires<Date.now()) { if(token) sessions.delete(token); return null; }
  return users[session.email]?.hash ? {email:session.email,...users[session.email],name:personName(users[session.email]),role:activeRole(users[session.email].role)} : null;
}
function view(workspace,user,users) {
  const result=workspaceForRole(workspace,user);
  result.actorJob=user.job || '';result.serverIdentity=true;result.personJobs={};
  const accounts=Object.values(users || {});
  const add=(name,role)=>{if(!name)return;const matches=accounts.filter(a=>personName(a)===name && (!role || activeRole(a.role)===role));if(matches.length===1 && matches[0].job)result.personJobs[name+'|'+(role || '')]=matches[0].job;};
  const visit=value=>{if(!value || typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}for(const [name,role] of [[value.reportedBy,value.reportedRole],[value.requestedBy,value.requestedRole],[value.author,value.authorRole],[value.actor,value.role]])add(name,role);Object.values(value).forEach(visit);};
  for(const key of ['requests','workOrders','reports','partRequests','inventory','preventive'])visit(result[key]);
  add(user.name,user.role);return result;
}
async function workspace() {
  const existing=await read('workspace.json',null);
  if(existing) return migrate(existing);
  const initial=seed();
  for(const key of ['requests','workOrders','preventive','reports','parts','documents','partRequests']) initial[key]=[];
  initial.revision=0;
  await save('workspace.json',initial);
  return initial;
}
const sameOrigin=req=>{try{return !req.headers.origin || new URL(req.headers.origin).host===req.headers.host;}catch{return false;}};
function adminAuthorized(req) {
  if(!adminToken) return false;
  const key=req.socket.remoteAddress || 'unknown',attempt=failedAdmin.get(key)||{count:0,until:0};
  if(attempt.until>Date.now()) return false;
  const given=Buffer.from(String(req.headers['x-amms-access-preview-admin-token'] || ''));
  const expected=Buffer.from(adminToken);
  const valid=given.length===expected.length && timingSafeEqual(given,expected);
  if(valid) { failedAdmin.delete(key); return true; }
  attempt.count++; attempt.until=attempt.count>=5?Date.now()+15*60_000:0; failedAdmin.set(key,attempt);
  return false;
}
const secureCookie=process.env.AMMS_ACCESS_PUBLIC_URL?.startsWith('https://')?'; Secure':'';
export async function api(req,res) {
  if(!req.url.startsWith('/api/')) return false;
  try {
    if(req.method==='GET' && req.url==='/api/status') {send(res,200,{mode:'server'});return true;}
    if(req.method==='POST' && (!sameOrigin(req) || req.headers['content-type']?.split(';')[0]!=='application/json')) {send(res,403,{error:'Invalid request origin or content type.'});return true;}
    const users=await read('users.json',{});
    if(req.method==='POST' && req.url==='/api/signup') {
      const input=await body(req),address=email(input.email),person=users[address];
      const inviteHash=createHash('sha256').update(String(input.invite || '').trim().toLowerCase()).digest();
      const expectedInvite=person?.inviteHash && /^[a-f0-9]{64}$/.test(person.inviteHash)?Buffer.from(person.inviteHash,'hex'):Buffer.alloc(32);
      if(!validEmail(address) || !person || !person.inviteHash || !timingSafeEqual(inviteHash,expectedInvite) || typeof input.password!=='string' || input.password.length<12 || input.password.length>200) {send(res,400,{error:'Account, activation code, or password is invalid.'});return true;}
      await serial(async()=>{
        const latest=await read('users.json',{});
        if(!latest[address] || latest[address].inviteHash!==person.inviteHash) throw Object.assign(new Error('Account unavailable.'),{status:409});
        const salt=randomBytes(16).toString('hex');
        latest[address].hash=`${salt}:${(await scrypt(input.password,salt,64)).toString('hex')}`;
        delete latest[address].inviteHash;
        await save('users.json',latest);
      });
      send(res,201,{ok:true});return true;
    }
    if(req.url==='/api/admin/users' && (req.method==='GET' || req.method==='POST')) {
      if(!adminToken) {send(res,503,{error:'Account administration is not configured on this server.'});return true;}
      if(req.method==='POST' && (!sameOrigin(req) || req.headers['content-type']?.split(';')[0]!=='application/json')) {send(res,403,{error:'Invalid request origin or content type.'});return true;}
      if(!adminAuthorized(req)) {send(res,401,{error:'Invalid or temporarily locked administrator key.'});return true;}
      if(req.method==='GET') {
        send(res,200,{users:Object.entries(users).map(([address,person])=>({email:address,name:person.name || '',surname:person.surname || '',job:person.job || '',role:activeRole(person.role),status:person.hash?'Active':'Activation pending'})).sort((a,b)=>a.email.localeCompare(b.email))});
        return true;
      }
      const input=await body(req),address=email(input.email),name=String(input.name || '').trim(),surname=String(input.surname || '').trim(),job=String(input.job || '').trim(),role=activeRole(input.role),action=input.action==='reset'?'reset':'provision';
      if(!validEmail(address) || !name || !surname || name.length>80 || surname.length>80 || job.length>100 || !roles.includes(role) || !['provision','reset'].includes(input.action)) {send(res,400,{error:'Enter a valid company email, name, surname, job and role.'});return true;}
      const activationCode=randomBytes(24).toString('hex');
      const result=await serial(async()=>{
        const latest=await read('users.json',{}),existing=latest[address];
        if(action==='provision' && existing?.hash) throw Object.assign(new Error('This user already has an account. Use reset access instead.'),{status:409});
        if(action==='reset' && !existing) throw Object.assign(new Error('User not found.'),{status:404});
        latest[address]={...existing,name,surname,job,role,inviteHash:createHash('sha256').update(activationCode).digest('hex')};
        delete latest[address].hash;
        for(const [token,session] of sessions) if(session.email===address) sessions.delete(token);
        await save('users.json',latest);
        return {email:address,name,surname,job,role,status:'Activation pending'};
      });
      send(res,200,{user:result,activationCode});return true;
    }
    if(req.method==='POST' && req.url==='/api/login') {
      const input=await body(req),address=email(input.email),account=users[address],attempt=failed.get(address)||{count:0,until:0};
      if(typeof input.password!=='string' || input.password.length>200) {send(res,401,{error:'Invalid email or password.'});return true;}
      if(attempt.until>Date.now()) {send(res,429,{error:'Too many attempts. Try later.'});return true;}
      const [salt,hex]=String(account?.hash || '').split(':');
      const candidate=await scrypt(String(input.password || ''),salt || 'missing-account',64);
      const expected=hex && /^[a-f0-9]{128}$/.test(hex)?Buffer.from(hex,'hex'):Buffer.alloc(64);
      if(!account?.hash || !timingSafeEqual(candidate,expected)) {
        attempt.count++;attempt.until=attempt.count>=5?Date.now()+15*60_000:0;failed.set(address,attempt);
        send(res,401,{error:'Invalid email or password.'});return true;
      }
      failed.delete(address);
      const token=randomBytes(32).toString('hex');sessions.set(token,{email:address,expires:Date.now()+8*60*60_000});
      send(res,200,{user:{name:personName(account),job:account.job || '',role:activeRole(account.role),email:address}},{'set-cookie':`amms_access_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${secureCookie}`});return true;
    }
    const user=userFor(req,users);
    if(!user) {send(res,401,{error:'Sign in required.'});return true;}
    if(req.method==='POST' && req.url==='/api/logout') {sessions.delete(cookie(req));send(res,200,{ok:true},{'set-cookie':'amms_access_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});return true;}
    if(req.method==='GET' && req.url==='/api/revision') {send(res,200,{revision:(await workspace()).revision || 0});return true;}
    if(req.method==='GET' && req.url==='/api/workspace') {send(res,200,{workspace:view(await workspace(),user,users),user:{email:user.email,name:user.name,job:user.job || '',role:user.role}});return true;}
    if(req.method==='POST' && req.url==='/api/command') {
      const command=await body(req);
      if(!command || typeof command.type!=='string' || (command.id!=null && typeof command.id!=='string') || (command.values!=null && (typeof command.values!=='object' || Array.isArray(command.values))) || (command.key!=null && !/^[a-f0-9-]{36}$/.test(command.key))) {send(res,400,{error:'Invalid command.'});return true;}
      if(command.values?.photos && (!Array.isArray(command.values.photos) || command.values.photos.length>4 || command.values.photos.some(photo=>typeof photo?.name!=='string' || photo.name.length>255 || typeof photo.data!=='string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.data) || photo.data.length>11_200_000))) {send(res,400,{error:'Invalid photo attachment.'});return true;}
      const result=await serial(async()=>{
        const current=await workspace();
        const receipt=command.key && `${user.email}:${command.key}`;
        if(receipt && current.appliedCommands?.includes(receipt)) return view(current,user,users);
        current.role=user.role;current.actor=user.name;current.actorEmail=user.email;current.actorJob=user.job || '';
        const before=recordIds(current);
        try { applyCommand(current,command); if(command.created) assignCreated(current,before,command.created); }
        catch(e) { e.status=409; throw e; }
        if(receipt) current.appliedCommands=[...(current.appliedCommands || []).slice(-999),receipt];
        current.revision=(current.revision||0)+1;
        await save('workspace.json',current);
        return view(current,user,users);
      });
      send(res,200,{workspace:result});return true;
    }
    send(res,404,{error:'Not found.'});return true;
  } catch(e) { if(!e.status) console.error('AMMS API error:',e); send(res,e.status || 500,{error:e.status?e.message:'Server error.'});return true;}
}
