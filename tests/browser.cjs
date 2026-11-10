// Run with an installed Playwright package. All browser state is disposable.
// Native window/DPR flags avoid a competing Playwright device-metrics session.
// Chrome's debugger banner may change viewport height; width/DPR/scroll are checked.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
const work=fs.mkdtempSync(path.join(process.env.GULIR_TEST_OUTPUT_PARENT||os.tmpdir(),'gulir-browser-'));
const extension=path.join(work,'extension');
fs.cpSync(path.join(project,'extension'),extension,{recursive:true,errorOnExist:true});
fs.appendFileSync(path.join(extension,'background.js'),'\n// Disposable test entry point only. No permission changes.\nglobalThis.__gulirTestCapture = capture;\n');
const executablePath=process.env.GULIR_CHROMIUM_EXECUTABLE||chromium.executablePath();
const report={artifactDirectory:work,executablePath,testOnlyInstrumentation:true,checks:[],limitations:[]};
const record=(name,status='PASSED',detail)=>{report.checks.push({name,status,detail});console.log(status+' '+name+(detail?': '+detail:''));};
const server=http.createServer((req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(['/dense-nested','/dense-previous-limit','/dense-large','/dense-over-limit'].includes(route)){
  res.setHeader('Content-Type','text/html');
  const rows=route==='/dense-over-limit'?4800:route==='/dense-large'?2400:route==='/dense-previous-limit'?720:420;
  const rowHeight=['/dense-large','/dense-over-limit'].includes(route)?1:4;
  const row='<div class="row">'+('<span></span>'.repeat(20))+'</div>';
  res.end('<!doctype html><style>html,body{margin:0}#outer{width:600px;height:300px;overflow:auto}#inner{height:200px;overflow:auto}.row{height:'+rowHeight+'px;display:flex}.row span{display:block;width:20px;height:'+rowHeight+'px;background:rgb(0,128,255)}footer{height:40px;background:lime}#tail{height:160px}</style><div id="outer"><div id="inner">'+row.repeat(rows)+'<footer></footer></div><div id="tail"></div></div>');
  return;
 }
 if(route==='/mutating-discovery'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html,body{margin:0}#wrapper{height:250px}gulir-moving-panel{display:block;position:fixed;top:0;left:0;width:600px;height:200px;overflow:auto}#later{width:600px;height:200px;overflow:auto}.data{height:1000px;background:linear-gradient(red,blue)}</style><div id="wrapper"><gulir-moving-panel id="mutator"><div class="data"></div></gulir-moving-panel></div><div id="later"><div class="data"></div></div><script>customElements.define("gulir-moving-panel",class extends HTMLElement{static get observedAttributes(){return ["style"]}attributeChangedCallback(){if(!window.moved&&this.style.position==="absolute"){window.moved=true;document.body.append(this.parentElement)}}});</script>');
  return;
 }
 if(route==='/entropy'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html,body{margin:0;width:4000px;height:5000px}canvas{display:block}</style><canvas width=4000 height=5000></canvas><script>const c=document.querySelector("canvas").getContext("2d"),im=c.createImageData(4000,5000);let seed=123456789;for(let i=0;i<im.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;im.data[i]=seed&255;im.data[i+1]=(seed>>>8)&255;im.data[i+2]=(seed>>>16)&255;im.data[i+3]=255;}c.putImageData(im,0,0);</script>');return;}
 if(route==='/grid'||route==='/growing'||route==='/lazy-growth'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html{scroll-behavior:smooth!important;scroll-snap-type:y mandatory!important}html,body{margin:0}body{width:2203px;height:2407px}canvas{display:block}#fixed{position:fixed!important;top:0;left:0;width:120px;height:40px;background:#ff00ff;visibility:visible!important;opacity:0.8!important;transition:opacity 1s!important}#bottom{position:fixed;bottom:0;left:300px;width:120px;height:30px;background:#00ff00;transition:opacity 1s!important}#right{position:fixed;right:0;top:100px;width:20px;height:100px;background:white}#sticky-wrap{position:absolute;top:500px;left:0;width:200px;height:600px}#sticky{position:sticky!important;top:10px!important;height:30px;background:#00ffff} #fixed span{visibility:visible!important}#contained{position:absolute;left:1500px;top:1300px;translate:0;width:100px;height:100px}#contained-fixed{position:fixed;left:10px;top:10px;width:40px;height:40px;background:#ffff00}</style><canvas width=2203 height=2407></canvas><div id=fixed><span style=background:#ff00ff;display:block;width:120px;height:40px></span></div><div id=bottom></div><div id=right></div><div id=sticky-wrap><div id=sticky></div></div><div id=contained><div id=contained-fixed></div></div><script>const c=document.querySelector("canvas").getContext("2d"),im=c.createImageData(2203,2407);for(let y=0;y<2407;y++)for(let x=0;x<2203;x++){let i=(y*2203+x)*4;im.data[i]=x%251;im.data[i+1]=y%251;im.data[i+2]=(Math.floor(x/251)+Math.floor(y/251)*9)%251;im.data[i+3]=255;}c.putImageData(im,0,0);'+(route==='/growing'?'addEventListener("scroll",()=>{if(scrollY>500)document.body.style.height=(document.body.scrollHeight+100)+"px";});':route==='/lazy-growth'?'addEventListener("scroll",()=>{if(scrollY>500)document.body.style.height="2507px";});':'')+'</script>');
  return;
 }
 if(route==='/late-fixed'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{margin:0;height:3200px;background:cyan}</style><script>addEventListener("scroll",()=>{if(scrollY>300&&!document.querySelector("#late")){const e=document.createElement("div");e.id="late";e.style.cssText="position:fixed;bottom:0;left:0;width:100%;height:80px;background:magenta";document.body.append(e)}});</script>');return;
 }
 if(route==='/shrinking-header'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>body{margin:0}header{position:sticky;top:0;height:100px;background:red}main{height:3200px;background:blue}footer{height:50px;background:lime}</style><header>HEADER</header><main></main><footer>BOTTOM</footer><script>addEventListener("scroll",()=>document.querySelector("header").style.height=scrollY>20?"80px":"100px");</script>');return;
 }
 if(route==='/nested-body'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html{height:100%;overflow:hidden}body{margin:0;height:100vh;overflow:auto}#body-data{height:2600px;background:linear-gradient(red,blue)}footer{height:100px;background:lime}</style><div id=body-data>BODY TOP</div><footer>BODY BOTTOM</footer>');return;
 }
 if(route==='/nested-offscreen'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html,body{margin:0}#space{height:100px}#outer{width:600px;height:300px;overflow:auto}#inner{height:200px;overflow:auto}#inner-data{height:1400px;background:linear-gradient(red,blue)}#tail{height:1600px;background:lime}</style><div id=space></div><div id=outer><div id=inner><div id=inner-data>INNER</div></div><div id=tail>TAIL</div></div>');return;
 }
 if(route==='/horizontal-grid'||route==='/horizontal-frame-body'||route==='/horizontal-table'){
  res.setHeader('Content-Type','text/html');
  const table=route==='/horizontal-table';
  res.end('<!doctype html><style>html,body{margin:0}table{border-collapse:collapse;width:1000px}td{padding:0}td:first-child{width:700px}td:last-child{width:300px;background:magenta}#clip{width:560px;height:270px;overflow:hidden}'+(table?'table#clip{width:1000px;height:270px;overflow:visible}':'')+'#panel{box-sizing:content-box;width:500px;height:200px;padding:5px;border:3px solid black;overflow:auto}canvas{display:block}footer{height:35px;background:lime}</style>'+(table?'<table id="clip"><tr><td>':'<div id="clip">')+'<div id="panel"><canvas width="2203" height="1407"></canvas></div>'+(table?'</td><td>ATTACHMENT</td></tr></table>':'</div>')+'<footer></footer><script>const g=document.querySelector("canvas").getContext("2d"),im=g.createImageData(2203,1407);for(let y=0;y<1407;y++)for(let x=0;x<2203;x++){const i=(y*2203+x)*4;im.data[i]=x%251;im.data[i+1]=y%251;im.data[i+2]=(Math.floor(x/251)+Math.floor(y/251)*9)%251;im.data[i+3]=255;}g.putImageData(im,0,0);</script>');return;
 }
 if(route==='/horizontal-frame'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html,body{margin:0}#wrap{width:600px;height:300px;overflow:hidden}iframe{display:block;width:600px;height:300px;border:0}footer{height:30px;background:magenta}</style><div id="wrap"><iframe src="/horizontal-frame-body"></iframe></div><footer></footer>');return;
 }
 if(route==='/nested-horizontal'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html,body{margin:0}#horizontal{width:300px;height:200px;overflow:auto}#wide{width:1000px;height:600px;background:linear-gradient(red,blue)}</style><div id=horizontal><div id=wide>WIDE PANEL</div></div>');return;
 }
 if(route==='/nested-app'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html,body{margin:0;height:100%;overflow:hidden}header{position:fixed;top:0;height:56px;width:100%;background:#123456}#shell{position:fixed;left:0;right:0;top:56px;bottom:0;overflow:auto}#intro{height:200px;background:#abcdef}.columns{display:flex;align-items:flex-start}#policy{width:600px;height:280px;max-height:280px!important;overflow-y:auto;flex:none}#data{width:600px;height:2400px;background:linear-gradient(red,blue)}#side{width:400px;height:120px;background:#fedcba}footer{height:60px;background:lime}</style><header>HEADER</header><main id=shell><div id=intro>INTRO <span id=clock>0</span></div><div class=columns><section id=policy><div id=data>POLICY TOP</div></section><aside id=side>SIDE</aside></div><footer>PAGE BOTTOM</footer></main><script>setInterval(()=>document.querySelector("#clock").textContent=String(Date.now()),200);</script>');
  return;
 }
 if(route==='/nested-pane'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html,body{margin:0}#space{height:100px}#outer{margin-left:100px;width:600px;height:300px;overflow:auto}#lead{height:50px;background:#abcdef}#policy{width:550px;height:250px;max-height:250px!important;overflow:auto}#data{width:550px;height:3500px;background:linear-gradient(red,blue)}footer{height:100px;background:lime}#carousel{height:80px;overflow:hidden}#slide{height:500px;background:#123456}textarea{width:200px;height:80px}</style><div id=space></div><div id=outer><div id=lead></div><div id=policy><div id=data>TOP</div></div></div><footer>BOTTOM</footer><div id=carousel><div id=slide></div></div><textarea>'+('not an expanded editor\n'.repeat(80))+'</textarea>');
  return;
 }
 if(route==='/frame-body'){
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html,body{margin:0}header{height:40px;background:#abcdef}#frame-policy{height:200px;max-height:200px;overflow:auto}#frame-data{height:2400px;width:600px;background:linear-gradient(red,blue)}footer{height:30px;background:#ff00ff}</style><header>FRAME TOP</header><div id=frame-policy><div id=frame-data>DATA</div></div><footer>FRAME BOTTOM</footer>');return;
 }
 if(route==='/nested-frame'||route==='/clipped-frame'||route==='/cross-frame'){
  res.setHeader('Content-Type','text/html');
  const src=route==='/cross-frame'?'http://localhost:'+server.address().port+'/frame-body':'/frame-body';
  res.end('<!doctype html><style>html,body{margin:0}#space{height:100px}iframe{display:block;margin-left:100px;width:600px;height:250px;border:0}#frameWrap{height:300px;overflow:hidden}footer{height:100px;background:lime}</style><div id=space></div>'+(route==='/clipped-frame'?'<div id=frameWrap>':'')+'<iframe src="'+src+'"></iframe>'+(route==='/clipped-frame'?'</div>':'')+'<footer>OUTER BOTTOM</footer>');return;
 }
 const long=route==='/long';
 const height=route==='/tall'?70001:long?35000:3200;
 res.setHeader('Content-Type','text/html');
 res.end('<!doctype html><title>Gulir fixture</title><style>html,body,h1{margin:0}body{width:1000px;height:'+height+'px;background:linear-gradient(red,blue)}footer{position:absolute;top:'+(height-100)+'px}</style><h1>TOP</h1><footer>BOTTOM</footer>'+(route==='/animated'?'<canvas id=animation width=256 height=256 style="position:absolute;top:300px;left:100px"></canvas><script>let frame=0,running=true;const c=document.getElementById("animation").getContext("2d");function draw(){if(!running)return;c.fillStyle="rgb("+(frame++%256)+",0,0)";c.fillRect(0,0,256,256);requestAnimationFrame(draw);}window.stopFixtureAnimation=()=>running=false;draw();</script>':''));
});
let context,worker,origin;
let browserDownloads=0;
async function launch(name,dpr=1){
 const profile=path.join(work,name),downloads=path.join(work,name+'-downloads');
 fs.mkdirSync(downloads,{recursive:true});fs.mkdirSync(path.join(profile,'Default'),{recursive:true});
 const preferences=path.join(profile,'Default','Preferences');
 if(!fs.existsSync(preferences))fs.writeFileSync(preferences,JSON.stringify({download:{default_directory:downloads,prompt_for_download:false,directory_upgrade:true}}));
 context=await chromium.launchPersistentContext(profile,{executablePath,headless:process.env.GULIR_HEADED!=='1',ignoreDefaultArgs:process.env.GULIR_CLASSIC_SCROLLBARS==='1'?['--hide-scrollbars']:[],viewport:null,acceptDownloads:false,args:['--window-size=1280,720','--force-device-scale-factor='+dpr,'--disable-extensions-except='+extension,'--load-extension='+extension]});
 context.setDefaultTimeout(15000);
 context.on('page',page=>page.on('download',()=>browserDownloads++));
 // Playwright's allowAndName download interception replaces native filenames.
 // Use normal Chrome downloads only inside this fresh profile and test directory.
 const setup=await context.newPage(),cdp=await context.newCDPSession(setup);
 await cdp.send('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:true});await setup.close();
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 return downloads;
}
async function targetFor(page){
 return worker.evaluate(async url=>{
  const target=(await chrome.debugger.getTargets()).find(t=>t.type==='page'&&t.url===url&&t.tabId);
  if(!target)throw Error('Synthetic fixture target missing');
  return target.tabId;
 },page.url());
}
async function invoke(page,expectError=false){
 await page.bringToFront();await page.waitForFunction(()=>document.visibilityState==='visible');
 const url=page.url(),tabId=await targetFor(page);
 await worker.evaluate(async id=>{const t=await chrome.tabs.get(id);await chrome.windows.update(t.windowId,{focused:true});await chrome.tabs.update(id,{active:true});},tabId);let active;for(let attempt=0;attempt<100;attempt++){active=await worker.evaluate(async id=>{const tab=await chrome.tabs.get(id);return (await chrome.tabs.query({active:true,windowId:tab.windowId}))[0]?.id;},tabId);if(active===tabId)break;await new Promise(r=>setTimeout(r,25));}assert.equal(active,tabId,'capture source must be active within its real Chrome window');
 const viewportBefore=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,x:scrollX,y:scrollY}));
 const waiting=context.waitForEvent('page',{timeout:180000}).catch(error=>({error}));
 await worker.evaluate(async({url,tabId})=>{
  const tab=await chrome.tabs.get(tabId);
  await globalThis.__gulirTestCapture({...tab,url,title:'Gulir fixture',status:'complete'});
 },{url,tabId});
 const viewportAfter=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,x:scrollX,y:scrollY}));report.viewportChecks ||= [];report.viewportChecks.push({viewportBefore,viewportAfter});for(const key of ['width','dpr','x','y'])assert.equal(viewportAfter[key],viewportBefore[key],'capture preserves '+key);
 const preview=await waiting;if(preview.error)throw preview.error;
 await preview.waitForLoadState();
 await preview.waitForFunction(()=>!document.getElementById('save').disabled||document.getElementById('status').textContent.trim());
 if(expectError){assert.equal(await preview.locator('#save').isDisabled(),true);return preview;}
 if(await preview.locator('#save').isDisabled())throw Error('Capture failed: '+await preview.locator('#status').innerText());
 await preview.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalHeight>0),null,{timeout:30000});
 return preview;
}
async function pageAt(route){const page=await context.newPage();await page.goto(origin+route);await page.waitForLoadState('load');return page;}
async function dimensions(preview){return preview.locator('#images img').evaluateAll(imgs=>imgs.map(i=>[i.naturalWidth,i.naturalHeight]));}
async function pngHash(preview){
 return preview.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(document.querySelector('#images img').src)).arrayBuffer()))].join(','));
}
async function verifyFile(name,expected,directory){
 const result=await worker.evaluate(async({name,directory})=>{
  let root=await navigator.storage.getDirectory();if(directory)root=await root.getDirectoryHandle(directory);
  const file=await (await root.getFileHandle(name)).getFile();
  return {name:file.name,size:file.size,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].join(','),header:[...new Uint8Array(await file.slice(0,8).arrayBuffer())]};
 },{name,directory});
 assert.equal(result.hash,expected);assert.ok(result.size>1000);assert.deepEqual(result.header,[137,80,78,71,13,10,26,10]);assert.equal(browserDownloads,0);return result.name;
}
async function survivors(preview){
 const id=await targetFor(preview);
 const before=await worker.evaluate(async id=>(await chrome.tabs.query({})).map(t=>({id:t.id,windowId:t.windowId,url:t.url})),id);
 const windows=await worker.evaluate(async()=> (await chrome.windows.getAll()).map(w=>w.id));
 return async()=>{
  if(!preview.isClosed())await preview.waitForEvent('close');
  assert.equal(preview.isClosed(),true,'only preview must close');
  const after=await worker.evaluate(async()=> (await chrome.tabs.query({})).map(t=>({id:t.id,windowId:t.windowId,url:t.url})));
  assert.deepEqual(after.sort((a,b)=>a.id-b.id),before.filter(tab=>tab.id!==id).sort((a,b)=>a.id-b.id),'all other tabs survive unchanged');
  const remaining=await worker.evaluate(async()=> (await chrome.windows.getAll()).map(w=>w.id));
  for(const windowId of new Set(before.filter(t=>t.id!==id).map(t=>t.windowId)))assert.ok(remaining.includes(windowId),'unrelated Chrome window survives');
  assert.ok(windows.length>=2,'preview is a separate real Chrome popup window');
 };
}
async function save(preview,name,enter=false,expectedName=name+'.png'){
 await preview.locator('#name').fill(name);const expected=await pngHash(preview),checkSurvivors=await survivors(preview);
 await preview.evaluate(async name=>{
  const root=await navigator.storage.getDirectory();let calls=0;
  window.showSaveFilePicker=async()=>{throw Error('Normal save must never open a filename chooser');};
  window.showDirectoryPicker=async options=>{
   if(++calls!==1||options.mode!=='readwrite'||document.querySelector('#name').value!==name)throw Error('Invalid directory picker invocation or lost UI filename');
   return root;
  };
 },name);
 if(enter===true)await preview.locator('#name').press('Enter');else await preview.locator('#save').click();
 await checkSurvivors();
 return verifyFile(expectedName,expected);
}
async function clockedPreview(page){
 const preview=await invoke(page);await preview.clock.install();await preview.clock.pauseAt(new Date());await preview.reload();
 await preview.waitForFunction(()=>!document.querySelector('#save').disabled);return preview;
}
async function denseRegression(){
  async function sample(preview,points){return preview.locator('#images img').evaluate((img,pts)=>{const c=document.createElement('canvas');c.width=1;c.height=1;const g=c.getContext('2d',{willReadFrequently:true});return pts.map(([x,y])=>{g.clearRect(0,0,1,1);g.drawImage(img,x,y,1,1,0,0,1,1);return Array.from(g.getImageData(0,0,1,1).data).slice(0,3);});},points);}
  const dense=await pageAt('/dense-nested');
  await dense.evaluate(()=>{document.querySelector('#outer').scrollTop=23;document.querySelector('#inner').scrollTop=47;});
  const denseSnapshot=()=>dense.evaluate(()=>['html','body','#outer','#inner'].map(sel=>{const e=document.querySelector(sel);return {style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop,h:sel==='html'?null:e.clientHeight};}));
  const denseBefore=await denseSnapshot();
  const denseNodes=await dense.evaluate(()=>document.querySelectorAll('*').length);
  assert.ok(denseNodes>8000&&denseNodes<15000,'synthetic dense page stays below the original 15,000-element guard');
  for(let attempt=0;attempt<2;attempt++){
   const shot=await invoke(dense);
   assert.deepEqual(await dimensions(shot),[[1280,1880]]);
   assert.deepEqual(await sample(shot,[[100,1],[100,1600],[100,1690],[100,1719]]),[[0,128,255],[0,128,255],[0,255,0],[0,255,0]]);
   assert.deepEqual(await denseSnapshot(),denseBefore,'dense nested panels restore after each capture');
   await shot.close();
  }
  record('dense '+denseNodes+'-element nested page: repeated one-PNG capture includes final panel pixels and restores styles/scroll');

  await dense.close();
  for(const [route,rows,rowHeight] of [['/dense-previous-limit',720,4],['/dense-large',2400,1]]){
    const large=await pageAt(route);
    await large.evaluate(()=>{document.querySelector('#outer').scrollTop=23;document.querySelector('#inner').scrollTop=47;});
    const snapshot=()=>large.evaluate(()=>['html','body','#outer','#inner'].map(sel=>{const e=document.querySelector(sel);return {style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop,h:sel==='html'?null:e.clientHeight};}));
    const before=await snapshot(),count=await large.evaluate(()=>document.querySelectorAll('*').length);
    assert.ok(count>15000&&count<100000);
    const started=Date.now(),shot=await invoke(large),bottom=rows*rowHeight;
    assert.deepEqual(await dimensions(shot),[[1280,bottom+200]]);
    assert.deepEqual(await sample(shot,[[100,1],[100,Math.floor(bottom/2)],[100,bottom-1],[100,bottom+10],[100,bottom+39]]),[[0,128,255],[0,128,255],[0,128,255],[0,255,0],[0,255,0]]);
    assert.deepEqual(await snapshot(),before);
    await shot.close();
    record('large '+count+'-element nested page: one complete PNG, final pixels and exact restoration','PASSED',String(Date.now()-started)+' ms');
    if(route==='/dense-large'){
      await large.evaluate(()=>document.querySelector('#inner .row:last-of-type span:last-child').className='ReactVirtualized__Grid');
      const rejected=await invoke(large,true);
      assert.match(await rejected.locator('#status').innerText(),/daftar virtual/);
      assert.equal(await rejected.locator('#images img').count(),0);
      assert.deepEqual(await snapshot(),before);
      await rejected.close();
      record('virtualized marker after 50,000 elements is still detected; zero images and exact restoration');
    }
    await large.close();
  }
  const over=await pageAt('/dense-over-limit');
  await over.evaluate(()=>{document.querySelector('#outer').scrollTop=23;document.querySelector('#inner').scrollTop=47;});
  const overSnapshot=()=>over.evaluate(()=>['#outer','#inner'].map(sel=>{const e=document.querySelector(sel);return {style:e.getAttribute('style'),y:e.scrollTop,h:e.clientHeight};}));
  const overBefore=await overSnapshot(),rejected=await invoke(over,true);
  assert.match(await rejected.locator('#status').innerText(),/PANEL_NODES: 100001\/100000/);
  assert.doesNotMatch(await rejected.locator('#status').innerText(),/DevTools|kebijakan Chrome/);
  assert.equal(await rejected.locator('#images img').count(),0);
  assert.deepEqual(await overSnapshot(),overBefore);
  await rejected.close(); await over.close();
  record('actual DOM limit rejects with count-only diagnostic, no partial image, and exact panel restoration');
  const mutating=await pageAt('/mutating-discovery');
  await mutating.evaluate(()=>{document.querySelector('#mutator').scrollTop=37;document.querySelector('#later').scrollTop=47;});
  const mutationSnapshot=()=>mutating.evaluate(()=>['#mutator','#later'].map(sel=>{const el=document.querySelector(sel);return {style:el.getAttribute('style'),scroll:el.scrollTop,height:el.clientHeight};}));
  const mutationBefore=await mutationSnapshot(),mutationShot=await invoke(mutating,true);
  assert.equal(await mutating.evaluate(()=>window.moved),true,'native custom element must reparent during style writes');
  assert.match(await mutationShot.locator('#status').innerText(),/berubah saat memeriksa panel/);
  assert.equal(await mutationShot.locator('#images img').count(),0);
  assert.deepEqual(await mutationSnapshot(),mutationBefore);
  assert.deepEqual(await mutating.evaluate(()=>[...document.body.children].filter(el=>['wrapper','later'].includes(el.id)).map(el=>el.id)),['later','wrapper'],'site-owned reparenting is not undone');
  await mutationShot.close();await mutating.close();
  record('native custom-element reparenting during discovery rejects with zero images and restores owned styles/scroll');


}
async function horizontalRegression(){
 const sample=(preview,pts)=>preview.locator('#images img').evaluate((img,points)=>{
  const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d',{willReadFrequently:true});
  return points.map(([x,y])=>{g.clearRect(0,0,1,1);g.drawImage(img,x,y,1,1,0,0,1,1);return [...g.getImageData(0,0,1,1).data].slice(0,3);});
 },pts);
 for(const route of ['/horizontal-grid','/horizontal-frame','/horizontal-table']){
  const page=await pageAt(route),frame=route==='/horizontal-frame'?page.frames().find(f=>f!==page.mainFrame()):page;
  await frame.evaluate(()=>{document.querySelector('#panel').scrollTo(180,150)});
  const snapshot=()=>frame.evaluate(()=>['#clip','#panel'].map(sel=>{const e=document.querySelector(sel);return {style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop,w:e.clientWidth,h:e.clientHeight}}));
  const before=await snapshot();
  for(let repeat=0;repeat<2;repeat++){
   const shot=await invoke(page),dims=await dimensions(shot);
   assert.equal(dims.length,1);assert.ok(dims[0][0]>=2219);assert.ok(dims[0][1]>=1458);
   const points=[[0,0],[1200,650],[2202,1406]].map(([x,y])=>[x+8,y+8]);
   const expected=[[0,0],[1200,650],[2202,1406]].map(([x,y])=>[x%251,y%251,(Math.floor(x/251)+Math.floor(y/251)*9)%251]);
   assert.deepEqual(await sample(shot,points),expected,'left, tiled middle and bottom-right pixels');
   assert.deepEqual(await snapshot(),before,'exact panel styles, geometry and both scroll axes restored');
   if(route==='/horizontal-table') {
    assert.deepEqual(await sample(shot,[[2300,100]]),[[255,0,255]],'adjacent table attachment panel stays visible');
    if(repeat===0)await save(shot,'horizontal-complete');else await shot.close();
   } else await shot.close();
  }
  await page.close();record(route+': repeated complete one-PNG capture, rightmost pixels and exact restoration');
 }
 {
  const page=await pageAt('/horizontal-grid');
  await page.evaluate(()=>{
   const clip=document.querySelector('#clip'),aside=document.createElement('aside');
   clip.style.cssText='width:716px;height:270px;overflow:visible;display:flex';
   aside.id='aside';aside.style.cssText='width:200px;height:200px;background:magenta;overflow:hidden';clip.append(aside);
  });
  const before=await page.locator('#aside').evaluate(e=>({style:e.getAttribute('style'),width:e.getBoundingClientRect().width}));
  const shot=await invoke(page);assert.deepEqual(await sample(shot,[[2300,100]]),[[255,0,255]]);
  assert.deepEqual(await page.locator('#aside').evaluate(e=>({style:e.getAttribute('style'),width:e.getBoundingClientRect().width})),before);
  await shot.close();await page.close();record('flex sidebar preserved without shrinking and original style restored');
 }
 for(const kind of ['oversize','virtualized','rtl','late-growth','grid-overlap','shadow-overlap','contents-overlap']){
  const page=await pageAt('/horizontal-grid');
  await page.evaluate(kind=>{
   const panel=document.querySelector('#panel');panel.scrollLeft=50;
   if(kind.endsWith('-overlap')){
    const clip=document.querySelector('#clip'),aside=document.createElement('aside');
    clip.style.cssText='width:600px;height:270px;overflow:visible;display:grid;grid-template-columns:400px 200px';
    panel.style.width='384px';
    aside.style.cssText='width:200px;height:200px;background:magenta;overflow:hidden';aside.textContent='VISIBLE SIBLING';clip.append(aside);
    if(kind==='contents-overlap'){const wrapper=document.createElement('div');wrapper.style.display='contents';aside.replaceWith(wrapper);wrapper.append(aside);}
    if(kind==='shadow-overlap'){const shadow=clip.attachShadow({mode:'open'});panel.style.cssText='width:400px;height:200px;overflow:auto';shadow.append(panel,aside);}
   }
   if(kind==='oversize')panel.firstElementChild.style.width='17000px';
   if(kind==='virtualized')panel.className='ReactVirtualized__Grid';
   if(kind==='rtl')panel.style.direction='rtl';
   if(kind==='late-growth'){panel.firstElementChild.style.height='1407px';addEventListener('scroll',()=>{if(scrollX>100)panel.firstElementChild.style.width='2400px'});}
  },kind);
  const before=await page.locator('#panel').evaluate(e=>({style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop,w:e.clientWidth,h:e.clientHeight}));
  const shot=await invoke(page,true);
  assert.equal(await shot.locator('#images img').count(),0);
  assert.match(await shot.locator('#status').innerText(),kind==='oversize'?/batas aman/:kind==='virtualized'?/virtual/:kind==='rtl'?/kanan-ke-kiri/:kind==='late-growth'?/Lebar isi panel|PANEL_HEIGHT/:/menutupi|mempersempit/);
  assert.deepEqual(await page.locator('#panel').evaluate(e=>({style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop,w:e.clientWidth,h:e.clientHeight})),before);
  await shot.close();await page.close();record(kind+': no partial PNG and panel restored');
 }
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 const downloads=await launch('standard');
 if(process.argv.includes('--horizontal')){
  await horizontalRegression();report.status='FOCUSED_HORIZONTAL_PASSED';report.limitations.push('Synthetic fixtures only, no authenticated live JNE page.');return;
 }
 if(process.argv.includes('--complexity')){
  await denseRegression();
  report.status='FOCUSED_COMPLEXITY_PASSED';
  report.limitations.push('Focused synthetic nested-panel capture only; no live JNE or full browser suite.');
  return;
 }
 const page=await pageAt('/short');
 const secondWindowPage=context.waitForEvent('page');
 await worker.evaluate(url=>chrome.windows.create({url,type:'normal'}),origin+'/short?survivor');
 const secondWindow=await secondWindowPage;await secondWindow.waitForLoadState();
 const preview=await invoke(page);
 assert.notEqual((await worker.evaluate(async ids=>Promise.all(ids.map(async id=>(await chrome.tabs.get(id)).windowId)),[await targetFor(page),await targetFor(secondWindow)]))[0],(await worker.evaluate(async id=>(await chrome.tabs.get(id)).windowId,await targetFor(secondWindow))));
 record('isolated browser has independent normal windows plus real extension popup');
 assert.match(await preview.locator('#summary').innerText(),/3200 px/);
 assert.deepEqual(await dimensions(preview),[[1280,3200]]);
 record('real debugger capture and popup preview, 1280x3200');
 assert.equal(await preview.locator('#folder').count(),0);assert.equal(await preview.locator('#save-direct').count(),0);
 assert.equal(await preview.locator('#discard').count(),0);assert.equal(await preview.locator('#quick-save').isChecked(),false);
 assert.match(await preview.locator('#countdown').innerText(),/60|59/);
 await preview.screenshot({path:path.join(work,'preview.png')});
 assert.equal(await save(preview,'test-shot',true),'test-shot.png');
 record('Enter submits directory save with exact UI filename and OPFS PNG; only preview closes; other tabs and windows remain open; quick save defaults off; no discard');
 const untouched=await invoke(page),automaticName=await untouched.locator('#name').inputValue();
 assert.ok(automaticName.length>0);
 assert.equal(await save(untouched,automaticName),automaticName+'.png');
 record('generated default filename is preserved exactly by the folder save flow');
 const repeated=await invoke(page);assert.equal(await save(repeated,'test-shot',false,'test-shot (1).png'),'test-shot (1).png');
 record('repeat capture detaches debugger, normal save adds collision suffix without overwriting');
 const interceptedPage=await pageAt('/short'),intercepted=await invoke(interceptedPage);
 const routing=await context.newCDPSession(interceptedPage),redirected=path.join(work,'routed-downloads');fs.mkdirSync(redirected);
 await routing.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:redirected,eventsEnabled:true});
 await intercepted.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('cancelled','AbortError')}});
 await intercepted.locator('#save').click();await intercepted.waitForFunction(()=>document.querySelector('#status').textContent.includes('dibatalkan'));
 assert.equal(await intercepted.locator('#save').isDisabled(),false);assert.equal(await intercepted.locator('#images img').count(),1);assert.equal(browserDownloads,0);
 record('picker cancellation retains preview without downloads');
 await intercepted.evaluate(()=>{window.showDirectoryPicker=async()=>({getFileHandle:async()=>{throw Error('test disk unavailable')}})});
 await intercepted.locator('#save').click();await intercepted.waitForFunction(()=>document.querySelector('#status').textContent.includes('test disk unavailable'));
 assert.equal(await intercepted.locator('#save').isDisabled(),false);assert.equal(await save(intercepted,'retry-after-failure'),'retry-after-failure.png');
 assert.deepEqual(fs.readdirSync(redirected),[]);assert.deepEqual(fs.readdirSync(downloads),[]);
 record('write failure retains preview; retry closes only preview; UUID download routing creates zero files');
 await routing.send('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:true});await routing.detach();
 report.limitations.push('Headless multi-window focus is not a native accelerator test: capture invokes the real background handler with the active source tab in its own window.');
 report.limitations.push('Directory dialogs are mocked with real OPFS handles; tests verify exact UI filenames and complete PNG bytes. Native OS folder chooser appearance and external-folder permission prompts require manual desktop verification.');
 const expires=await clockedPreview(page);
 assert.match(await expires.locator('#countdown').innerText(),/60/);
 await expires.clock.runFor(15000);assert.match(await expires.locator('#countdown').innerText(),/45/);
 await expires.locator('#name').fill('timer-reset');assert.match(await expires.locator('#countdown').innerText(),/60/);
 await expires.clock.runFor(59000);assert.equal(expires.isClosed(),false);
 const expirySurvivors=await survivors(expires);await expires.clock.runFor(1000);await expirySurvivors();
 record('visible 60-second countdown ticks, resets on input, closes only preview at deadline');
 const deferred=await clockedPreview(page);
 await deferred.evaluate(()=>{window.__pickerCalls=0;window.showDirectoryPicker=()=>{window.__pickerCalls++;return new Promise((resolve,reject)=>window.__cancelPicker=()=>reject(new DOMException('cancelled','AbortError')));};});
 await deferred.locator('#save').click();await deferred.evaluate(()=>{document.querySelector('#form').requestSubmit();document.querySelector('#form').requestSubmit();});
 assert.equal(await deferred.evaluate(()=>window.__pickerCalls),1);
 await deferred.clock.runFor(120000);assert.equal(deferred.isClosed(),false);assert.equal(await deferred.locator('#save').isDisabled(),true);
 await deferred.evaluate(()=>window.__cancelPicker());await deferred.waitForFunction(()=>!document.querySelector('#save').disabled);
 assert.match(await deferred.locator('#countdown').innerText(),/60/);await deferred.clock.runFor(59000);assert.equal(deferred.isClosed(),false);await deferred.close();
 record('picker pauses expiry, duplicate submits lock, cancellation restarts full countdown');
 const writing=await clockedPreview(page),writeHash=await pngHash(writing);
 await writing.evaluate(async()=>{
  const root=await navigator.storage.getDirectory();
  window.showDirectoryPicker=async()=>({getFileHandle:async(name,options)=>{
   const handle=await root.getFileHandle(name,options);
   return {name,createWritable:async()=>{
    const writer=await handle.createWritable();return {write:async blob=>{await writer.write(blob);await new Promise(resolve=>window.__finishWrite=resolve);},close:()=>writer.close(),abort:()=>writer.abort()};
   }};
  }});
 });
 await writing.locator('#name').fill('deferred-write');await writing.locator('#save').click();await writing.waitForFunction(()=>typeof window.__finishWrite==='function');
 await writing.clock.runFor(120000);assert.equal(writing.isClosed(),false);
 await writing.evaluate(()=>window.__finishWrite());if(!writing.isClosed())await writing.waitForEvent('close');assert.equal(writing.isClosed(),true);
 await verifyFile('deferred-write.png',writeHash);assert.deepEqual(fs.readdirSync(downloads),[]);assert.deepEqual(fs.readdirSync(redirected),[]);
 record('active write pauses countdown, commits exact PNG, then closes only preview with zero downloads');

 const quick=await invoke(page);await quick.locator('#quick-save').check();await quick.locator('#name').fill('remembered');
 await quick.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('cancelled','AbortError')};});
 await quick.locator('#save').click();await quick.waitForFunction(()=>!document.querySelector('#save').disabled&&document.querySelector('#status').textContent.includes('dibatalkan'));
 assert.equal(quick.isClosed(),false);assert.equal(browserDownloads,0);
 const quickHash=await pngHash(quick);
 await quick.evaluate(async()=>{
  const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('remembered-tests',{create:true});
  window.showSaveFilePicker=async()=>{throw Error('Quick save unexpectedly opened file chooser')};
  window.showDirectoryPicker=async options=>{if(options.mode!=='readwrite')throw Error('Wrong directory mode');return folder;};
 });
 await quick.locator('#save').click();if(!quick.isClosed())await quick.waitForEvent('close');assert.equal(quick.isClosed(),true);
 await verifyFile('remembered.png',quickHash,'remembered-tests');
 const remembered=await invoke(page);assert.equal(await remembered.locator('#quick-save').isChecked(),true);
 const persisted=await remembered.evaluate(async()=>{
  const {loadSavePreferences}=await import('./save-preferences.js');const prefs=await loadSavePreferences();
  const original=await (await navigator.storage.getDirectory()).getDirectoryHandle('remembered-tests');
  return {enabled:prefs.enabled,kind:prefs.directoryHandle.kind,same:await prefs.directoryHandle.isSameEntry(original),permission:await prefs.directoryHandle.queryPermission({mode:'readwrite'})};
 });
 assert.deepEqual(persisted,{enabled:true,kind:'directory',same:true,permission:'granted'});
 await remembered.evaluate(async()=>{const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('remembered-tests');const writer=await (await folder.getFileHandle('remembered.png')).createWritable();await writer.write('Existing user file must not be overwritten');await writer.close();});
 await remembered.locator('#name').fill('remembered');
 await remembered.evaluate(()=>{window.showDirectoryPicker=window.showSaveFilePicker=async()=>{throw Error('Persisted granted folder must not reopen chooser')};});
 await remembered.locator('#name').press('Enter');if(!remembered.isClosed())await remembered.waitForEvent('close');assert.equal(remembered.isClosed(),true);
 await verifyFile('remembered (1).png',quickHash,'remembered-tests');assert.equal(await worker.evaluate(async()=>await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('remembered-tests')).getFileHandle('remembered.png')).getFile().then(file=>file.text())),'Existing user file must not be overwritten');
 record('quick save cancellation retains preview; preference and real directory handle persist in IndexedDB; granted permission avoids chooser; collision gets suffix without overwrite');
 const denied=await invoke(page);await denied.locator('#name').fill('denied-fallback');const deniedHash=await pngHash(denied);
 await denied.evaluate(async()=>{
  const fallback=await (await navigator.storage.getDirectory()).getDirectoryHandle('fallback-tests',{create:true});
  FileSystemHandle.prototype.queryPermission=async()=> 'denied';
  FileSystemHandle.prototype.requestPermission=async()=> 'denied';
  window.showDirectoryPicker=async()=>fallback;
  window.showSaveFilePicker=async()=>{throw Error('Denied folder fallback must use directory chooser')};
 });
 await denied.locator('#save').click();if(!denied.isClosed())await denied.waitForEvent('close');assert.equal(denied.isClosed(),true);
 await verifyFile('denied-fallback.png',deniedHash,'fallback-tests');
 record('revoked remembered-folder permission falls back to directory chooser and writes exact PNG');
 const disabled=await invoke(page);assert.equal(await disabled.locator('#quick-save').isChecked(),true);await disabled.locator('#quick-save').uncheck();
 await disabled.waitForFunction(async()=>!(await (await import('./save-preferences.js')).loadSavePreferences()).enabled);
 await disabled.close();
 const disabledAgain=await invoke(page);assert.equal(await disabledAgain.locator('#quick-save').isChecked(),false);
 await save(disabledAgain,'quick-save-disabled');record('disabling remembered folder persists and restores normal directory chooser flow');
 assert.equal(browserDownloads,0);assert.deepEqual(fs.readdirSync(downloads),[]);assert.deepEqual(fs.readdirSync(redirected),[]);
 const errorPage=context.waitForEvent('page');
 await worker.evaluate(()=>globalThis.__gulirTestCapture({id:9999,url:'chrome://settings',title:'Settings'}));
 const errorExpiry=await errorPage;await errorExpiry.waitForLoadState();await errorExpiry.clock.install();await errorExpiry.clock.pauseAt(new Date());await errorExpiry.reload();
 await errorExpiry.waitForFunction(()=>document.querySelector('#status').textContent.includes('Tab ini tidak dapat'));
 const errorSurvivors=await survivors(errorExpiry);
 await errorExpiry.clock.runFor(60000);await errorSurvivors();
 record('error preview expiry closes only its popup; source tabs and independent windows survive');
 if(process.argv.includes('--save-only')){report.status='SAVE_ACCEPTANCE_PASSED_WITH_REPORTED_LIMITATIONS';return;}
 const longPage=await pageAt('/long'),longPreview=await invoke(longPage);
 assert.deepEqual(await dimensions(longPreview),[[1280,35000]]);
 const samples=await longPreview.locator('#images img').evaluate(img=>{
  const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),rows=[];
  for(let y=499;y<img.naturalHeight;y+=397){
   ctx.clearRect(0,0,1,1);ctx.drawImage(img,500,y,1,1,0,0,1,1);
   rows.push({y,rgb:Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)});
  }return rows;
 });
 for(const {y,rgb} of samples){
  const blue=255*(y+0.5)/35000;
  assert.ok(Math.abs(rgb[0]-(255-blue))<=3&&rgb[1]===0&&Math.abs(rgb[2]-blue)<=3,'single PNG interior content mismatch at '+y+' '+rgb);
 }
 report.longPageInteriorSamples=samples;
 record('35000px capture: ONE PNG, exact dimensions and continuous interior content');

 const longFile=await save(longPreview,'long-shot');
 assert.equal(longFile,'long-shot.png');
 record('35000px single file direct save without numbered parts or downloads');

 await longPreview.close();
 const waiting=context.waitForEvent('page',{timeout:180000}).catch(error=>({error}));
 await worker.evaluate(()=>globalThis.__gulirTestCapture({id:9999,url:'chrome://settings',title:'Settings'}));
 const restricted=await waiting;if(restricted.error)throw restricted.error;
 await restricted.waitForFunction(()=>document.getElementById('status').textContent.includes('Tab ini tidak dapat'));
 assert.equal(await restricted.locator('#save').isDisabled(),true);
 record('restricted tab produces visible error without save');await restricted.close();
 const gridPage=await pageAt('/grid');
 await gridPage.evaluate(()=>scrollTo({left:321,top:455,behavior:'instant'}));
 const grid=await invoke(gridPage);
 assert.deepEqual(await dimensions(grid),[[2203,2407]]);
 const gridSamples=await grid.locator('#images img').evaluate(img=>{
  const c=document.createElement('canvas');c.width=1;c.height=1;const g=c.getContext('2d',{willReadFrequently:true});
  const sample=(x,y)=>{g.drawImage(img,x,y,1,1,0,0,1,1);return Array.from(g.getImageData(0,0,1,1).data).slice(0,3);};
  const points=[];for(let y=61;y<2407;y+=31)for(let x=211;x<2203;x+=37){
   if(x>=1508&&x<1552&&y>=1308&&y<1352)continue;
   if(x>=300&&x<420&&y<900||x>=1200&&y>=100&&y<200)continue;
   points.push({x,y,rgb:sample(x,y)});
  }const bottomRows=[],rightColumns=[];for(let y=0;y<1200;y++){const rgb=sample(350,y);if(rgb[0]===0&&rgb[1]===255&&rgb[2]===0)bottomRows.push(y);}for(let x=0;x<2203;x++){if(sample(x,150).every(v=>v===255))rightColumns.push(x);}return {points,bottomRows,rightColumns,fixed:sample(10,10),sticky:sample(10,510),contained:sample(1520,1320),bottom:sample(2202,2406)};
 });
 for(const {x,y,rgb} of gridSamples.points)assert.deepEqual(rgb,[x%251,y%251,(Math.floor(x/251)+Math.floor(y/251)*9)%251],'coordinate pixel '+x+','+y);
 assert.ok(gridSamples.fixed[0]>200&&gridSamples.fixed[1]<20&&gridSamples.fixed[2]>200);assert.deepEqual(gridSamples.sticky,[0,255,255]);assert.deepEqual(gridSamples.contained,[255,255,0]);
 assert.equal(gridSamples.bottomRows.length,30,'whole bottom-fixed panel appears once');assert.equal(gridSamples.rightColumns.length,20,'whole right-fixed panel appears once');
 assert.deepEqual(gridSamples.bottom,[2202%251,2406%251,(Math.floor(2202/251)+Math.floor(2406/251)*9)%251]);
 const restoredStyles=await gridPage.evaluate(()=>({fixed:getComputedStyle(document.querySelector('#fixed')).visibility,opacity:getComputedStyle(document.querySelector('#fixed')).opacity,opacityInline:document.querySelector('#fixed').style.getPropertyValue('opacity'),transition:getComputedStyle(document.querySelector('#fixed')).transitionDuration,transitionInline:document.querySelector('#fixed').style.getPropertyValue('transition-property'),sticky:getComputedStyle(document.querySelector('#sticky')).position,top:document.querySelector('#sticky').style.getPropertyValue('top'),smooth:getComputedStyle(document.documentElement).scrollBehavior,snap:getComputedStyle(document.documentElement).scrollSnapType}));
 assert.deepEqual(restoredStyles,{fixed:'visible',opacity:'0.8',opacityInline:'',transition:'1s',transitionInline:'',sticky:'sticky',top:'',smooth:'smooth',snap:'y mandatory'});
 report.gridSamples=gridSamples;record('horizontal/final partial tiles: exact coordinate pixels, fixed/sticky/contained UI and scroll/style restoration');await grid.close();
 const latePage=await pageAt('/late-fixed'),late=await invoke(latePage);
 const latePixels=await late.locator('#images img').evaluate(img=>{const c=document.createElement('canvas');c.width=1;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,100,0,1,img.naturalHeight,0,0,1,img.naturalHeight);return [...g.getImageData(0,0,1,img.naturalHeight).data]});
 for(let i=0;i<latePixels.length;i+=4)assert.deepEqual(latePixels.slice(i,i+4),[0,255,255,255]);
 assert.equal(await latePage.evaluate(()=>document.querySelector('#late').style.opacity),'');record('late fixed overlay never repeats or covers strips and original opacity restored');await late.close();
 const lazyPage=await pageAt('/lazy-growth'),lazy=await invoke(lazyPage);
 assert.deepEqual(await dimensions(lazy),[[2203,2507]]);record('finite lazy growth retries ONE whole PNG after bounded loading');await lazy.close();
 const shrinkingPage=await pageAt('/shrinking-header'),shrinking=await invoke(shrinkingPage);
 assert.deepEqual(await dimensions(shrinking),[[1280,3350]]);
 const footerPixel=await shrinking.locator('#images img').evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(img,100,3340,1,1,0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]});assert.deepEqual(footerPixel,[0,255,0,255]);
 assert.equal(await shrinkingPage.evaluate(()=>document.querySelector('header').style.minHeight),'');record('shrinking sticky header preserves flow, bottom pixels and restores styles');await shrinking.close();
 const growingPage=await pageAt('/growing'),growing=await invoke(growingPage,true);
 assert.match(await growing.locator('#status').innerText(),/terus memuat|belum stabil|Ukuran halaman berubah/);
 assert.equal(await growingPage.evaluate(()=>getComputedStyle(document.querySelector('#sticky')).position),'sticky');
 assert.equal(await growingPage.evaluate(()=>getComputedStyle(document.querySelector('#fixed')).opacity),'0.8');
 record('growing page rejects without partial output and restores sticky state');await growing.close();
 if(process.env.GULIR_NESTED==='1'||process.argv.includes('--nested')){
  async function sample(preview,points){return preview.locator('#images img').evaluate((img,pts)=>{const c=document.createElement('canvas');c.width=1;c.height=1;const g=c.getContext('2d',{willReadFrequently:true});return pts.map(([x,y])=>{g.clearRect(0,0,1,1);g.drawImage(img,x,y,1,1,0,0,1,1);return Array.from(g.getImageData(0,0,1,1).data).slice(0,3);});},points);}
  await denseRegression();
  const gradient=(rgb,y,total,label)=>{const blue=255*(y+0.5)/total;assert.ok(Math.abs(rgb[0]-(255-blue))<=3&&rgb[1]===0&&Math.abs(rgb[2]-blue)<=3,label+' '+rgb);};
  const app=await pageAt('/nested-app');
  await app.evaluate(()=>{document.querySelector('#shell').scrollTop=75;document.querySelector('#policy').scrollTop=300;});
  const appBefore=await app.evaluate(()=>['html','body','#shell','#policy'].map(sel=>{const e=document.querySelector(sel);return {sel,style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop};}));
  const appShot=await invoke(app);assert.equal((await dimensions(appShot)).length,1);assert.ok((await dimensions(appShot))[0][1]>=2716);
  const appPixels=await sample(appShot,[[200,356],[200,1256],[200,2555],[200,2680]]);
  gradient(appPixels[0],100,2400,'app top');gradient(appPixels[1],1000,2400,'app middle');gradient(appPixels[2],2299,2400,'app bottom');assert.deepEqual(appPixels[3],[0,255,0]);
  const appAfter=await app.evaluate(()=>['html','body','#shell','#policy'].map(sel=>{const e=document.querySelector(sel);return {sel,style:e.getAttribute('style'),x:e.scrollLeft,y:e.scrollTop};}));
  assert.deepEqual(appAfter,appBefore,'restore fixed app shell, nested pane, styles and offsets');
  assert.match(await appShot.locator('#summary').innerText(),/area scroll diperluas/);
  const appFile=await save(appShot,'nested-app','Screenshots/Test');assert.equal(path.basename(appFile),'nested-app.png');
  record('fixed viewport app shell + nested pane: full bottom, one PNG, exact restoration');await appShot.close();

  const pane=await pageAt('/nested-pane');await pane.evaluate(()=>{document.querySelector('#outer').scrollTop=40;document.querySelector('#policy').scrollTop=250;});
  const paneBefore=await pane.evaluate(()=>['#outer','#policy','#carousel','textarea'].map(sel=>{const e=document.querySelector(sel);return {sel,style:e.getAttribute('style'),h:e.clientHeight,y:e.scrollTop};}));
  const paneShot=await invoke(pane);assert.ok((await dimensions(paneShot))[0][1]>=3750);
  const panePixels=await sample(paneShot,[[200,250],[200,2150],[200,3649],[200,3690]]);
  gradient(panePixels[0],100,3500,'pane top');gradient(panePixels[1],2000,3500,'pane middle');gradient(panePixels[2],3499,3500,'pane bottom');assert.deepEqual(panePixels[3],[0,255,0]);
  const paneAfter=await pane.evaluate(()=>['#outer','#policy','#carousel','textarea'].map(sel=>{const e=document.querySelector(sel);return {sel,style:e.getAttribute('style'),h:e.clientHeight,y:e.scrollTop};}));
  assert.deepEqual(paneAfter,paneBefore);record('nested overflow panes expand bottom-up; hidden carousel/editor stay bounded; restoration exact');await paneShot.close();

  const framed=await pageAt('/nested-frame');await framed.frameLocator('iframe').locator('#frame-policy').evaluate(el=>el.scrollTop=100);
  const frameBefore=await framed.evaluate(()=>{const e=document.querySelector('iframe'),p=e.contentDocument.querySelector('#frame-policy');return {style:e.getAttribute('style'),h:e.clientHeight,childStyle:p.getAttribute('style'),scroll:p.scrollTop};});
  const frameShot=await invoke(framed);assert.ok((await dimensions(frameShot))[0][1]>=2670);
  const framePixels=await sample(frameShot,[[200,240],[200,1940],[200,2539],[200,2555],[200,2610]]);
  gradient(framePixels[0],100,2400,'frame top');gradient(framePixels[1],1800,2400,'frame middle');gradient(framePixels[2],2399,2400,'frame bottom');assert.deepEqual(framePixels[3],[255,0,255]);assert.deepEqual(framePixels[4],[0,255,0]);
  const frameAfter=await framed.evaluate(()=>{const e=document.querySelector('iframe'),p=e.contentDocument.querySelector('#frame-policy');return {style:e.getAttribute('style'),h:e.clientHeight,childStyle:p.getAttribute('style'),scroll:p.scrollTop};});
  assert.deepEqual(frameAfter,frameBefore);record('same-origin iframe + inner scroller: entire frame and outer footer in one PNG, restored');await frameShot.close();

  const bodyPage=await pageAt('/nested-body');await bodyPage.evaluate(()=>document.body.scrollTop=200);
  const bodyBefore=await bodyPage.evaluate(()=>({style:document.body.getAttribute('style'),scroll:document.body.scrollTop}));
  const bodyShot=await invoke(bodyPage);assert.ok((await dimensions(bodyShot))[0][1]>=2700);const bodyPixels=await sample(bodyShot,[[500,100],[500,2599],[500,2650]]);
  gradient(bodyPixels[0],100,2600,'body top');gradient(bodyPixels[1],2599,2600,'body bottom');assert.deepEqual(bodyPixels[2],[0,255,0]);assert.deepEqual(await bodyPage.evaluate(()=>({style:document.body.getAttribute('style'),scroll:document.body.scrollTop})),bodyBefore);
  record('inner body scrollbar under clipped html expands fully and restores');await bodyShot.close();

  const offscreen=await pageAt('/nested-offscreen');await offscreen.evaluate(()=>document.querySelector('#outer').scrollTop=1000);
  const offShot=await invoke(offscreen);assert.ok((await dimensions(offShot))[0][1]>=3100);const offPixel=await sample(offShot,[[200,1499]]);gradient(offPixel[0],1399,1400,'initially offscreen inner bottom');assert.equal(await offscreen.evaluate(()=>document.querySelector('#outer').scrollTop),1000);record('initially scrolled parent does not hide nested-scroll discovery');await offShot.close();

  const clipped=await pageAt('/clipped-frame'),clippedShot=await invoke(clipped);assert.ok((await dimensions(clippedShot))[0][1]>=2670);const clippedPixel=await sample(clippedShot,[[200,2555],[200,2610]]);assert.deepEqual(clippedPixel,[[255,0,255],[0,255,0]]);assert.equal(await clipped.evaluate(()=>document.querySelector('#frameWrap').clientHeight),300);record('same-origin iframe expands through clipped ancestor and restores it');await clippedShot.close();

  const horizontal=await pageAt('/nested-horizontal');await horizontal.evaluate(()=>document.querySelector('#horizontal').scrollLeft=80);
  const horizontalShot=await invoke(horizontal);assert.equal((await dimensions(horizontalShot)).length,1);assert.deepEqual(await sample(horizontalShot,[[999,599]]),[[0,0,255]]);assert.equal(await horizontal.evaluate(()=>document.querySelector('#horizontal').scrollLeft),80);record('horizontal inner overflow captures rightmost bottom pixel and restores offset');await horizontalShot.close();

  const crossed=await pageAt('/cross-frame'),crossShot=await invoke(crossed);
  assert.ok((await crossShot.locator('#warnings').innerText()).trim(),'cross-origin frame limitation must be visible');
  record('cross-origin iframe remains untouched with explicit visible coverage warning');await crossShot.close();
 }
 const moving=await pageAt('/animated'),animated=await invoke(moving);
 assert.deepEqual(await dimensions(animated),[[1280,3200]]);await animated.close();
 await moving.evaluate(()=>window.stopFixtureAnimation());
 const stopped=await invoke(moving);assert.deepEqual(await dimensions(stopped),[[1280,3200]]);
 record('animated page can be captured without forced stability rejection');await stopped.close();

 for(const zoom of [1.25,2]){
  const tabId=await targetFor(page);await worker.evaluate(({tabId,zoom})=>chrome.tabs.setZoom(tabId,zoom),{tabId,zoom});
  await page.waitForTimeout(150);
  const expected=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]);
  const zoomed=await invoke(page);assert.deepEqual(await dimensions(zoomed),[expected]);
  record('Chrome zoom '+zoom+': one output pixel per CSS pixel');await zoomed.close();
 }
 await worker.evaluate(tabId=>chrome.tabs.setZoom(tabId,1),await targetFor(page));
 await page.bringToFront();
 const shortcut=context.waitForEvent('page',{timeout:2500}).catch(()=>null);
 await page.keyboard.press('Alt+s');
 const keyboardPreview=await shortcut;
 if(keyboardPreview){
  await keyboardPreview.waitForFunction(()=>!document.getElementById('save').disabled);
  record('Alt+S invokes the real extension action');await keyboardPreview.close();
 }else{
  record('Alt+S activation','NOT_VERIFIED','Headless keyboard events did not invoke a Chrome browser accelerator; manual desktop check remains.');
  report.limitations.push('Real desktop shortcut activation is not verified.');
 }
 const preferencePage=await context.newPage();await preferencePage.goto('chrome-extension://'+new URL(worker.url()).host+'/preview.html');
 await preferencePage.evaluate(async()=>{await (await import('./save-preferences.js')).setRememberFolder(true);});await preferencePage.close();
 await context.close();context=null;
 await launch('standard');
 const restored=await invoke(await pageAt('/short?restart'));
 assert.equal(await restored.locator('#quick-save').isChecked(),true);
 const restartPrefs=await restored.evaluate(async()=>{const prefs=await (await import('./save-preferences.js')).loadSavePreferences();return {kind:prefs.directoryHandle.kind,permission:await prefs.directoryHandle.queryPermission({mode:'readwrite'}),name:prefs.directoryHandle.name};});
 assert.deepEqual(restartPrefs,{kind:'directory',permission:'granted',name:'fallback-tests'});
 await restored.locator('#name').fill('after-restart');const restartHash=await pngHash(restored);
 await restored.evaluate(()=>{window.showDirectoryPicker=window.showSaveFilePicker=async()=>{throw Error('Restart must reuse persisted granted directory')};});
 await restored.locator('#save').click();if(!restored.isClosed())await restored.waitForEvent('close');assert.equal(restored.isClosed(),true);
 await verifyFile('after-restart.png',restartHash,'fallback-tests');
 record('browser restart persists preference and real directory handle, queries permission and saves without chooser');
 await context.close();context=null;
 await launch('last-tab-guard');
 async function solePreview(mode) {
  const source=await pageAt('/short?last-tab-'+mode),last=await clockedPreview(source),lastId=await targetFor(last);
  const hash=await pngHash(last);
  await worker.evaluate(async id=>{const others=(await chrome.tabs.query({})).filter(t=>t.id!==id);if(others.length)await chrome.tabs.remove(others.map(t=>t.id));},lastId);
  assert.equal((await worker.evaluate(()=>chrome.windows.getAll())).length,1);
  const closed=last.waitForEvent('close');
  if(mode==='expiry')await last.clock.runFor(60000);
  else {
   await last.locator('#name').fill('last-tab-save');
   await last.evaluate(()=>{window.showDirectoryPicker=()=>navigator.storage.getDirectory();});
   await last.locator('#save').click();
  }
  await closed;
  const survivors=await worker.evaluate(async()=>({tabs:await chrome.tabs.query({}),windows:await chrome.windows.getAll()}));
  assert.equal(survivors.windows.length,1);assert.equal(survivors.windows[0].type,'normal');
  assert.equal(survivors.tabs.length,1);assert.notEqual(survivors.tabs[0].id,lastId);
  // A usable page and live extension worker prove more than a brief CDP connection.
  const live=await context.newPage();await live.goto(origin+'/short?alive-'+mode);assert.equal(await live.title(),'Gulir fixture');await live.close();
  if(mode==='save')await verifyFile('last-tab-save.png',hash);
  record('sole preview '+mode+' closes only after normal New Tab exists; Chrome remains usable');
 }
 await solePreview('expiry');await solePreview('save');
 const concurrentSource=await pageAt('/short?concurrent'),first=await clockedPreview(concurrentSource),second=await clockedPreview(concurrentSource);
 const ids=[await targetFor(first),await targetFor(second)];
 await worker.evaluate(async ids=>{const others=(await chrome.tabs.query({})).filter(tab=>!ids.includes(tab.id));if(others.length)await chrome.tabs.remove(others.map(tab=>tab.id));},ids);
 await Promise.all([first.clock.runFor(60000),second.clock.runFor(60000)]);
 for(const preview of [first,second])if(!preview.isClosed())await preview.waitForEvent('close');
 const remaining=await worker.evaluate(async()=>({tabs:await chrome.tabs.query({}),windows:await chrome.windows.getAll()}));
 assert.equal(remaining.tabs.length,1);assert.equal(remaining.windows.length,1);assert.equal(remaining.windows[0].type,'normal');
 record('simultaneous last previews close through serialized requests, leaving one usable normal window');
 if(process.env.GULIR_TALL==='1'){
  await context.close();context=null;await launch('tall');
  const tall=await invoke(await pageAt('/tall'));
  assert.deepEqual(await dimensions(tall),[[1280,70001]]);
  const tallSamples=await tall.locator('#images img').evaluate(img=>{
   const c=document.createElement('canvas');c.width=1;c.height=1;const g=c.getContext('2d',{willReadFrequently:true}),out=[];
   for(const y of [499,16383,32767,32768,65534,65535,65536,69999]){g.drawImage(img,500,y,1,1,0,0,1,1);out.push({y,rgb:Array.from(g.getImageData(0,0,1,1).data).slice(0,3)});}return out;
  });
  for(const {y,rgb} of tallSamples){const blue=255*(y+0.5)/70001;assert.ok(Math.abs(rgb[0]-(255-blue))<=3&&rgb[1]===0&&Math.abs(rgb[2]-blue)<=3,'70K gradient '+y);}
  const file=await save(tall,'one-70001','Screenshots/Test');assert.equal(path.basename(file),'one-70001.png');
  report.tallSamples=tallSamples;record('70001px single PNG exceeds 64K height: decoded pixels and one complete download');
 }
 if(process.env.GULIR_STRESS==='1'){
  await context.close();context=null;await launch('high-entropy');
  const entropy=await invoke(await pageAt('/entropy'));
  assert.deepEqual(await dimensions(entropy),[[4000,5000]]);
  record('20MP high-entropy canvas captures as one PNG');
 }else report.limitations.push('High-entropy stress case not requested in this run.');

 report.status='BROWSER_ACCEPTANCE_PASSED_WITH_REPORTED_LIMITATIONS';
})().catch(error=>{report.status='FAILED';report.error=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{
 if(context)await context.close();server.close();
 fs.writeFileSync(path.join(work,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('REPORT '+path.join(work,'report.json'));
});
