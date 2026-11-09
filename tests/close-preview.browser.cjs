// Real Chrome APIs and unmodified runtime in a disposable extension/profile.
// Only directory selection and wall-clock passage are controlled by the test.
const {chromium}=require('playwright');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'gulir-close-'));
const extension=path.join(work,'extension');
fs.cpSync(path.resolve(__dirname,'../extension'),extension,{recursive:true});
fs.writeFileSync(path.join(extension,'close-fixture.html'),'<!doctype html><title>Disposable test fixture</title>');
const report={artifactDirectory:work,headed:process.env.GULIR_HEADED==='1',checks:[],limitations:['Disposable profile, never personal Chrome tabs.','Native directory picker replaced with actual OPFS handle. Countdown advanced through Playwright clock.']};
const record=name=>{report.checks.push(name);console.log('PASSED '+name);};
let context,worker,counter=0,downloads=0;
async function preview({clock=false,normal=false}={}) {
 const seed=await context.newPage();await seed.goto(await worker.evaluate(()=>chrome.runtime.getURL('close-fixture.html')));
 const id='close-test-'+(++counter),url=await seed.evaluate(async id=>{
  const {dbOp}=await import('./db.js');
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9e8AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  await dbOp('put',{id,created:Date.now(),name:id,width:1,height:1,parts:[new Blob([bytes],{type:'image/png'})]});
  return chrome.runtime.getURL('preview.html?id='+id);
 },id);await seed.close();
 const next=context.waitForEvent('page');
 if(normal)await worker.evaluate(url=>chrome.tabs.create({url}),url);
 else await worker.evaluate(url=>chrome.windows.create({url,type:'popup',width:1000,height:800}),url);
 const page=await next;await page.waitForLoadState();
 if(clock){await page.clock.install();await page.clock.pauseAt(new Date());await page.reload();}
 await page.waitForFunction(()=>!document.querySelector('#save').disabled);
 return page;
}
const snapshot=()=>worker.evaluate(async()=>({tabs:(await chrome.tabs.query({})).map(t=>({id:t.id,windowId:t.windowId})),windows:(await chrome.windows.getAll()).map(w=>({id:w.id,type:w.type}))}));
const idFor=page=>page.evaluate(async()=> (await chrome.tabs.getCurrent()).id);
async function unchangedExcept(before,ids) {
 const after=await snapshot();assert.deepEqual(after.tabs,before.tabs.filter(tab=>!ids.includes(tab.id)));
 for(const windowId of new Set(before.tabs.filter(tab=>!ids.includes(tab.id)).map(tab=>tab.windowId)))assert.ok(after.windows.some(window=>window.id===windowId));
}
async function save(page) {
 const name=await page.locator('#name').inputValue();
 await page.evaluate(()=>{window.showDirectoryPicker=()=>navigator.storage.getDirectory();});
 const closed=page.waitForEvent('close');await page.locator('#save').click();await closed;
 const bytes=await worker.evaluate(async name=>[...new Uint8Array(await (await (await navigator.storage.getDirectory()).getFileHandle(name+'.png')).getFile().then(file=>file.arrayBuffer()))],name);
 assert.deepEqual(bytes.slice(0,8),[137,80,78,71,13,10,26,10]);assert.equal(bytes.length,68);assert.equal(downloads,0);
}
async function leaveOnly(pages) {
 const ids=await Promise.all(pages.map(idFor));
 await worker.evaluate(async ids=>{const tabs=(await chrome.tabs.query({})).filter(tab=>!ids.includes(tab.id));if(tabs.length)await chrome.tabs.remove(tabs.map(tab=>tab.id));},ids);
 return ids;
}
async function usableNormalWindow() {
 const state=await snapshot();assert.equal(state.windows.length,1);assert.equal(state.windows[0].type,'normal');assert.equal(state.tabs.length,1);
 const page=context.pages().find(page=>!page.isClosed());assert.ok(page);
 await page.goto('data:text/html,<title>Chrome still running</title><p>Browser survived preview close</p>');
 assert.equal(await page.title(),'Chrome still running');return state;
}
(async()=>{
 const executablePath=process.env.GULIR_CHROMIUM_EXECUTABLE||chromium.executablePath();report.executablePath=executablePath;
 context=await chromium.launchPersistentContext(path.join(work,'profile'),{executablePath,headless:!report.headed,viewport:null,args:['--window-size=1280,800','--disable-extensions-except='+extension,'--load-extension='+extension]});
 context.setDefaultTimeout(15000);context.on('page',page=>page.on('download',()=>downloads++));
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 await worker.evaluate(()=>chrome.windows.create({url:'about:blank',type:'normal'}));
 const saved=await preview(),id=await idFor(saved),before=await snapshot();
 await saved.screenshot({path:path.join(work,'preview-1.2.8.png')});
 assert.equal(before.windows.filter(window=>window.type==='normal').length,2);
 await save(saved);await unchangedExcept(before,[id]);
 record('save closes only its popup; two independent normal windows and all original tab IDs survive');
 const expired=await preview({clock:true}),expiredId=await idFor(expired),beforeExpiry=await snapshot();
 const expiryClosed=expired.waitForEvent('close');await expired.clock.runFor(60000);await expiryClosed;await unchangedExcept(beforeExpiry,[expiredId]);
 record('countdown closes only its popup; normal windows and tabs unchanged');
 const normal=await preview({normal:true}),normalId=await idFor(normal),beforeNormal=await snapshot();
 await save(normal);await unchangedExcept(beforeNormal,[normalId]);
 record('preview inside normal window closes only its own tab');
 for(const mode of ['expiry','save']) {
  const last=await preview({clock:true});await leaveOnly([last]);assert.equal((await snapshot()).windows[0].type,'popup');
  if(mode==='expiry'){const closed=last.waitForEvent('close');await last.clock.runFor(60000);await closed;}else await save(last);
  await usableNormalWindow();record('sole preview '+mode+' replaces popup with normal New Tab; browser remains usable');
 }
 const one=await preview({clock:true}),two=await preview({clock:true});await leaveOnly([one,two]);
 const closed=[one.waitForEvent('close'),two.waitForEvent('close')];await Promise.all([one.clock.runFor(60000),two.clock.runFor(60000)]);await Promise.all(closed);
 await usableNormalWindow();record('simultaneous final previews close, leaving exactly one usable normal window');
 const caller=await context.newPage();await caller.goto(await worker.evaluate(()=>chrome.runtime.getURL('close-fixture.html')));
 const forged=await caller.evaluate(()=>chrome.runtime.sendMessage({type:'gulir:close-preview',tabId:123}));await caller.close();
 // The fixture page is not a preview document and cannot pick a target.
 assert.deepEqual(forged,{closed:false});await usableNormalWindow();record('non-preview caller cannot request closure or supply a target tab');
 report.status='PASSED';
})().catch(error=>{report.status='FAILED';report.error=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{
 if(context)await context.close();fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('REPORT '+path.join(work,'report.json'));
});
