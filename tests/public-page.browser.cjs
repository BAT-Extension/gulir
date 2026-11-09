// Opt-in public landing-page regression. Fresh disposable profile; no login/forms.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const work=fs.mkdtempSync(path.join(process.env.GULIR_TEST_OUTPUT_PARENT||os.tmpdir(),'gulir-public-'));
const extension=path.join(work,'extension');
fs.cpSync(path.join(root,'extension'),extension,{recursive:true});
fs.appendFileSync(path.join(extension,'background.js'),'\nglobalThis.__gulirTestCapture=capture;\n');
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(work,'profile'),{executablePath:process.env.GULIR_CHROMIUM_EXECUTABLE||chromium.executablePath(),headless:true,viewport:null,args:['--force-device-scale-factor='+(process.env.GULIR_TEST_DPR||'1'),'--window-size='+(process.env.GULIR_TEST_WINDOW_SIZE||'1280,720'),'--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage();await page.goto('https://bitwarden.com/',{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(1500);await page.bringToFront();
  const before=await page.evaluate(()=>({url:location.href,x:scrollX,y:scrollY}));
  const next=context.waitForEvent('page',{timeout:180000}).catch(error=>({error}));
  await worker.evaluate(async()=>{const target=(await chrome.debugger.getTargets()).find(t=>t.type==='page'&&t.url==='https://bitwarden.com/'&&t.tabId);if(!target)throw Error('Unexpected public test tab');const tab=await chrome.tabs.get(target.tabId);await chrome.windows.update(tab.windowId,{focused:true});await chrome.tabs.update(tab.id,{active:true});await globalThis.__gulirTestCapture({...tab,url:target.url,status:'complete'});});
  const preview=await next;if(preview.error)throw preview.error;await preview.waitForLoadState();await preview.waitForFunction(()=>!document.querySelector('#save').disabled||document.querySelector('#status').textContent.trim());
  assert.equal(await preview.locator('#save').isDisabled(),false,await preview.locator('#status').innerText());
  await preview.waitForFunction(()=>[...document.querySelectorAll('#images img')].every(i=>i.complete&&i.naturalHeight));
  const data=await preview.locator('#images img').evaluate(async img=>({width:img.naturalWidth,height:img.naturalHeight,bytes:[...new Uint8Array(await(await fetch(img.src)).arrayBuffer())]}));
  fs.writeFileSync(path.join(work,'bitwarden-public.png'),Buffer.from(data.bytes));
  await preview.screenshot({path:path.join(work,'preview.png')});
  assert.deepEqual(await page.evaluate(()=>({url:location.href,x:scrollX,y:scrollY})),before);
  const report={status:'PUBLIC_BITWARDEN_CAPTURE_PASS',width:data.width,height:data.height,restored:true,login:false,form_submitted:false,artifactDirectory:work};
  fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
