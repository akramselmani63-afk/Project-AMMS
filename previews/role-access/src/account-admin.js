let adminKey='';
const byId=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function request(method='GET',data) {
  const response=await fetch('/api/admin/users',{method,cache:'no-store',headers:{'x-amms-access-preview-admin-token':adminKey,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error||'Request failed.');
  return result;
}
function showCode(code,user,action) {
  byId('code-recipient').textContent=`${action==='reset'?'Password reset':'Account activation'} for ${user.name} ${user.surname} · ${user.email}`;
  byId('activation-code').textContent=code;
  byId('code-panel').classList.remove('hidden');
  byId('code-panel').scrollIntoView({behavior:'smooth',block:'center'});
}
async function loadUsers() {
  const {users}=await request();
  byId('user-list').innerHTML=users.length?users.map(user=>`<tr><td>${safe(`${user.name} ${user.surname}`.trim())}</td><td>${safe(user.email)}</td><td>${safe(user.job||'—')}</td><td>${safe(user.role)}</td><td><span class="status ${user.status==='Active'?'':'pending'}">${safe(user.status)}</span></td><td><button type="button" data-reset="${safe(user.email)}">Reset access</button></td></tr>`).join(''):'<tr><td colspan="6">No accounts yet.</td></tr>';
}
byId('connect-form').addEventListener('submit',async event=>{
  event.preventDefault();
  adminKey=new FormData(event.currentTarget).get('key').trim();
  event.currentTarget.reset();
  byId('connect-message').textContent='';
  try { await loadUsers(); byId('workspace').classList.remove('hidden'); byId('connect-message').textContent='Connected.'; }
  catch(error) { adminKey=''; byId('connect-message').textContent=error.message; }
});
byId('user-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.currentTarget));
  try { const result=await request('POST',{...values,action:'provision'}); showCode(result.activationCode,result.user,'provision'); event.currentTarget.reset(); await loadUsers(); byId('user-message').textContent='Account created.'; }
  catch(error) { byId('user-message').textContent=error.message; }
});
byId('user-list').addEventListener('click',async event=>{
  const button=event.target.closest('[data-reset]'); if(!button) return;
  const email=button.dataset.reset;
  if(!confirm(`Reset access for ${email}? Their current password will stop working immediately.`)) return;
  button.disabled=true;
  try { const result=await request('POST',{action:'reset',email}); showCode(result.activationCode,result.user,'reset'); await loadUsers(); }
  catch(error) { byId('user-message').textContent=error.message; button.disabled=false; }
});
byId('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(byId('activation-code').textContent);byId('copy-code').textContent='Copied';}catch{byId('copy-code').textContent='Select and copy the code';}});
byId('dismiss-code').addEventListener('click',()=>{byId('activation-code').textContent='';byId('code-panel').classList.add('hidden');});
addEventListener('pagehide',()=>{adminKey='';});
