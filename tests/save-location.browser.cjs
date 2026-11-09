// Storage-location display on real extension pages with real OPFS handles.
const {chromium}=require('playwright'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'gulir-location-')),extension=path.join(work,'extension');
fs.cpSync(path.resolve(__dirname,'../extension'),extension,{recursive:true});fs.writeFileSync(path.join(extension,'fixture.html'),'<!doctype html><title>Storage fixture</title>');
const report={checks:[],headed:process.env.GULIR_HEADED==='1',limitations:['Isolated Chromium, not personal Chrome profile.','Native directory picker controlled; actual OPFS file handles and writes. Full OS paths are unavailable by API design.']};
let context,setup,worker,index=0;
const record=name=>{report.checks.push(name);console.log('PASSED '+name);};
async function preview(permission) {
 const id='location-'+(++index),url=await setup.evaluate(async id=>{
  const {dbOp}=await import('./db.js');
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9e8AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  await dbOp('put',{id,created:Date.now(),name:id,width:1,height:1,parts:[new Blob([bytes],{type:'image/png'})]});return chrome.runtime.getURL('preview.html?id='+id);
 },id);
 const page=await context.newPage();
 if(permission)await page.addInitScript(permission=>{window.__permissionRequests=0;FileSystemHandle.prototype.queryPermission=async()=>permission;FileSystemHandle.prototype.requestPermission=async()=>{window.__permissionRequests++;throw Error('Must not prompt before save');};},permission);
 await page.goto(url);await page.waitForFunction(()=>!document.querySelector('#save').disabled);return page;
}
async function chooseAndPause(page,folder) {
 await page.evaluate(async folder=>{
  const directory=await (await navigator.storage.getDirectory()).getDirectoryHandle(folder,{create:true});
  window.showDirectoryPicker=async()=>directory;
  const original=FileSystemFileHandle.prototype.createWritable;
  FileSystemFileHandle.prototype.createWritable=async function(){const writer=await original.call(this);return {write:async blob=>{await writer.write(blob);await new Promise(resolve=>window.__finishWrite=resolve);},close:()=>writer.close(),abort:()=>writer.abort()};};
 },folder);
 await page.locator('#save').click();await page.waitForFunction(()=>typeof window.__finishWrite==='function');
}
async function finish(page) {const closed=page.waitForEvent('close');await page.evaluate(()=>window.__finishWrite());await closed;}
(async()=>{
 context=await chromium.launchPersistentContext(path.join(work,'profile'),{headless:!report.headed,viewport:{width:1100,height:1050},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});context.setDefaultTimeout(15000);
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');setup=await context.newPage();await setup.goto(await worker.evaluate(()=>chrome.runtime.getURL('fixture.html')));
 const initial=await preview();assert.equal(await initial.locator('#save-location').innerText(),'Pilih folder saat Simpan PNG');assert.match(await initial.locator('#location-note').innerText(),/bukan path lengkap/);assert.equal(await initial.locator('#last-save').isHidden(),true);
 await initial.locator('#quick-save').check();assert.equal(await initial.locator('#save-location').innerText(),'Belum ada folder tersimpan');await initial.locator('#quick-save').uncheck();
 await initial.locator('#name').fill('my-picture');await chooseAndPause(initial,'Pictures');
 assert.equal(await initial.locator('#save-location').innerText(),'Pictures / my-picture.png');await initial.screenshot({path:path.join(work,'selected-location.png')});await finish(initial);
 record('no-selection and first quick-save states are honest; selected folder and exact filename appear during committed save');
 const next=await preview();assert.equal(await next.locator('#save-location').innerText(),'Pilih folder saat Simpan PNG');assert.equal(await next.locator('#last-save').innerText(),'Terakhir disimpan: Pictures / my-picture.png');
 await next.locator('#name').fill('my-picture');await chooseAndPause(next,'Pictures');assert.equal(await next.locator('#save-location').innerText(),'Pictures / my-picture (1).png');await finish(next);
 record('last successful location survives new preview; normal mode does not imply folder reuse; collision path uses actual suffixed filename');
 await setup.evaluate(async()=>{const {preferenceOp}=await import('./db.js');const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('Remembered screenshots',{create:true});await preferenceOp('put','save-directory-handle',folder);await preferenceOp('put','remember-save-folder',true);});
 const remembered=await preview();await remembered.waitForFunction(()=>document.querySelector('#location-note').textContent.includes('Izin folder tersedia'));
 await remembered.locator('#name').fill('edited-name');assert.equal(await remembered.locator('#save-location').innerText(),'Remembered screenshots / edited-name.png');await remembered.screenshot({path:path.join(work,'remembered-location.png')});
 await remembered.locator('#quick-save').uncheck();assert.equal(await remembered.locator('#save-location').innerText(),'Pilih folder saat Simpan PNG');await remembered.close();record('remembered permitted folder and edited name update immediately; disabling quick save clears planned destination');
 for(const permission of ['prompt','denied']){
  await setup.evaluate(async()=>{await (await import('./save-preferences.js')).setRememberFolder(true);});const page=await preview(permission);
  await page.waitForFunction(permission=>document.querySelector('#location-note').textContent.includes(permission==='prompt'?'Konfirmasi izin':'Izin folder tidak tersedia'),permission);
  assert.match(await page.locator('#save-location').innerText(),/^Remembered screenshots \/ /);assert.equal(await page.evaluate(()=>window.__permissionRequests),0);await page.close();
 }
 record('prompt and denied folder permissions are labeled without requesting permission during preview');
 await setup.evaluate(async()=>{await (await import('./save-preferences.js')).setRememberFolder(false);});
 const cancelled=await preview();await cancelled.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('cancelled','AbortError');};});await cancelled.locator('#save').click();await cancelled.waitForFunction(()=>document.querySelector('#status').textContent.includes('dibatalkan'));
 assert.equal(await cancelled.locator('#save-location').innerText(),'Pilih folder saat Simpan PNG');assert.equal(await cancelled.locator('#last-save').innerText(),'Terakhir disimpan: Pictures / my-picture (1).png');
 await cancelled.evaluate(()=>{window.showDirectoryPicker=async()=>({name:'Failed destination',getFileHandle:async(name,options)=>{if(!options?.create)throw new DOMException('missing','NotFoundError');return {name,createWritable:async()=>({write:async()=>{throw Error('disk full');},abort:async()=>{}})};}});});
 await cancelled.locator('#save').click();await cancelled.waitForFunction(()=>document.querySelector('#status').textContent.includes('disk full'));
 assert.equal(await cancelled.locator('#save-location').innerText(),'Pilih folder saat Simpan PNG');assert.equal(await cancelled.locator('#last-save').innerText(),'Terakhir disimpan: Pictures / my-picture (1).png');await cancelled.close();
 record('cancellation and failed write do not claim a new destination or overwrite last successful save');
 report.status='PASSED';
})().catch(error=>{report.status='FAILED';report.error=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{if(context)await context.close();fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('REPORT '+path.join(work,'report.json'));});
