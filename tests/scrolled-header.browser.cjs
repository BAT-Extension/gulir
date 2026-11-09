// Synthetic regression: capture starts below a sticky animated header,11px smaller.
// The old pipeline rejects on retry; fixed capture must include every footer pixel.
const {chromium}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const work=fs.mkdtempSync(path.join(process.env.GULIR_TEST_OUTPUT_PARENT||os.tmpdir(),'gulir-scrolled-header-'));
const server=require('node:http').createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{margin:0}header{position:sticky;top:0;height:100px;background:red;transition:height .3s}main{height:3200px;background:blue}footer{height:50px;background:lime}</style><header>HEADER</header><main></main><footer>BOTTOM</footer><script>addEventListener("scroll",()=>document.querySelector("header").style.height=scrollY>20?"89px":"100px");</script>')});
const extension=path.join(work,'extension');
fs.cpSync(path.join(root,'extension'),extension,{recursive:true});
fs.appendFileSync(path.join(extension,'background.js'),'\nglobalThis.__gulirTestCapture=capture;\n');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const context=await chromium.launchPersistentContext(path.join(work,'profile'),{executablePath:process.env.GULIR_CHROMIUM_EXECUTABLE||chromium.executablePath(),headless:true,ignoreDefaultArgs:process.env.GULIR_CLASSIC_SCROLLBARS?['--hide-scrollbars']:[],viewport:null,args:['--force-device-scale-factor='+(process.env.GULIR_TEST_DPR||'1'),'--window-size='+(process.env.GULIR_TEST_WINDOW_SIZE||'1280,720'),'--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(1500);await page.bringToFront();
  await page.evaluate(()=>scrollTo(0,1200));await page.waitForTimeout(1000);
  const before=await page.evaluate(()=>({url:location.href,x:scrollX,y:scrollY}));
  const next=context.waitForEvent('page',{timeout:180000}).catch(error=>({error}));
  await worker.evaluate(async(url)=>{const target=(await chrome.debugger.getTargets()).find(t=>t.type==='page'&&t.url===url+'/'&&t.tabId);if(!target)throw Error('Unexpected public test tab');const tab=await chrome.tabs.get(target.tabId);await chrome.windows.update(tab.windowId,{focused:true});await chrome.tabs.update(tab.id,{active:true});await globalThis.__gulirTestCapture({...tab,url:target.url,status:'complete'});},url);
  const preview=await next;if(preview.error)throw preview.error;await preview.waitForLoadState();await preview.waitForFunction(()=>!document.querySelector('#save').disabled||document.querySelector('#status').textContent.trim());
  assert.equal(await preview.locator('#save').isDisabled(),false,await preview.locator('#status').innerText());
  await preview.waitForFunction(()=>[...document.querySelectorAll('#images img')].every(i=>i.complete&&i.naturalHeight));
  const data=await preview.locator('#images img').evaluate(async img=>({width:img.naturalWidth,height:img.naturalHeight,bytes:[...new Uint8Array(await(await fetch(img.src)).arrayBuffer())]}));
  assert.equal(data.height,3350);
  const bottom=await preview.locator('#images img').evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d');g.drawImage(img,100,3340,1,1,0,0,1,1);return [...g.getImageData(0,0,1,1).data]});assert.deepEqual(bottom,[0,255,0,255]);
  fs.writeFileSync(path.join(work,'fixture.png'),Buffer.from(data.bytes));
  await preview.screenshot({path:path.join(work,'preview.png')});
  assert.deepEqual(await page.evaluate(()=>({url:location.href,x:scrollX,y:scrollY})),before);
  const report={status:'SCROLLED_ANIMATED_HEADER_CAPTURE_PASS',width:data.width,height:data.height,restored:true,login:false,form_submitted:false,artifactDirectory:work};
  fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await context.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
