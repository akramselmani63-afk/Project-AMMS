const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('offline Retry waits five visible seconds and shows the message again',async()=>{
 const script=fs.readFileSync('scripts/AMMSLauncher.cs','utf8').match(/<script>(.*?)<\/script>/)[1];let load,frame,shown=0;const dialog={open:false,showModal(){shown++;this.open=true},close(){this.open=false}};const document={hidden:false,getElementById:()=>dialog};const context={window:{addEventListener:(n,h)=>load=h},document,requestAnimationFrame:fn=>frame=fn,AbortController,setTimeout,clearTimeout,fetch:async()=>{throw Error('offline')},location:{}};vm.runInNewContext(script,context);load();frame(0);for(let now=100;now<5000;now+=100)frame(now);assert.equal(shown,0);frame(5000);await new Promise(setImmediate);assert.equal(shown,1);context.retryConnection();assert.equal(dialog.open,false);frame(6000);for(let now=6100;now<=11000;now+=100)frame(now);await new Promise(setImmediate);assert.equal(shown,2);
});
test('Windows and Android clients use the company HTTPS endpoint without bypassing TLS',()=>{
 const launcher=fs.readFileSync('scripts/AMMSLauncher.cs','utf8');
 assert.match(launcher,/#else\s+string url = "https:\/\/192\.168\.90\.215\/"/);
 assert.match(launcher,/fetch\('https:\/\/192\.168\.90\.215\/api\/status'/);
 assert.match(launcher,/#if ADMIN\s+string url = "http:\/\/127\.0\.0\.1:4274\/"/);
 const android=fs.readFileSync('android/app/src/main/java/com/agridiam/amms/MainActivity.java','utf8');
 assert.match(android,/START_URL = "https:\/\/192\.168\.90\.215\/"/);
 assert.match(android,/uri.getPort\(\) == -1 \|\| uri.getPort\(\) == 443/);
 assert.doesNotMatch(android,/handler\.proceed\(|onReceivedSslError/);
 const security=fs.readFileSync('android/app/src/main/res/xml/network_security_config.xml','utf8');
 assert.match(security,/>192\.168\.90\.215<\/domain>/);
 assert.match(security,/<certificates src="system"/);
 assert.doesNotMatch(security,/cleartextTrafficPermitted="true"/);
});
