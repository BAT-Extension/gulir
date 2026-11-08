// Run with an installed Playwright package. All browser state is disposable.
// Native window/DPR flags avoid a competing Playwright device-metrics session.
// Chrome's debugger banner may change viewport height; width/DPR/scroll are checked.
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
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
 if(route==='/entropy'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><style>html,body{margin:0;width:4000px;height:5000px}canvas{display:block}</style><canvas width=4000 height=5000></canvas><script>const c=document.querySelector("canvas").getContext("2d"),im=c.createImageData(4000,5000);let seed=123456789;for(let i=0;i<im.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;im.data[i]=seed&255;im.data[i+1]=(seed>>>8)&255;im.data[i+2]=(seed>>>16)&255;im.data[i+3]=255;}c.putImageData(im,0,0);</script>');return;}
 if(route==='/grid'||route==='/growing'){
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><style>html{scroll-behavior:smooth!important;scroll-snap-type:y mandatory!important}html,body{margin:0}body{width:2203px;height:2407px}canvas{display:block}#fixed{position:fixed!important;top:0;left:0;width:120px;height:40px;background:#ff00ff;visibility:visible!important;opacity:0.8!important;transition:opacity 1s!important}#bottom{position:fixed;bottom:0;left:300px;width:120px;height:30px;background:#00ff00;transition:opacity 1s!important}#right{position:fixed;right:0;top:100px;width:20px;height:100px;background:white}#sticky-wrap{position:absolute;top:500px;left:0;width:200px;height:600px}#sticky{position:sticky!important;top:10px!important;height:30px;background:#00ffff} #fixed span{visibility:visible!important}#contained{position:absolute;left:1500px;top:1300px;translate:0;width:100px;height:100px}#contained-fixed{position:fixed;left:10px;top:10px;width:40px;height:40px;background:#ffff00}</style><canvas width=2203 height=2407></canvas><div id=fixed><span style=background:#ff00ff;display:block;width:120px;height:40px></span></div><div id=bottom></div><div id=right></div><div id=sticky-wrap><div id=sticky></div></div><div id=contained><div id=contained-fixed></div></div><script>const c=document.querySelector("canvas").getContext("2d"),im=c.createImageData(2203,2407);for(let y=0;y<2407;y++)for(let x=0;x<2203;x++){let i=(y*2203+x)*4;im.data[i]=x%251;im.data[i+1]=y%251;im.data[i+2]=(Math.floor(x/251)+Math.floor(y/251)*9)%251;im.data[i+3]=255;}c.putImageData(im,0,0);'+(route==='/growing'?'addEventListener("scroll",()=>{if(scrollY>500)document.body.style.height="2507px";});':'')+'</script>');
  return;
 }
 const long=route==='/long';
 const height=route==='/tall'?70001:long?35000:3200;
 res.setHeader('Content-Type','text/html');
 res.end('<!doctype html><title>Gulir fixture</title><style>html,body,h1{margin:0}body{width:1000px;height:'+height+'px;background:linear-gradient(red,blue)}footer{position:absolute;top:'+(height-100)+'px}</style><h1>TOP</h1><footer>BOTTOM</footer>'+(route==='/animated'?'<canvas id=animation width=256 height=256 style="position:absolute;top:300px;left:100px"></canvas><script>let frame=0,running=true;const c=document.getElementById("animation").getContext("2d");function draw(){if(!running)return;c.fillStyle="rgb("+(frame++%256)+",0,0)";c.fillRect(0,0,256,256);requestAnimationFrame(draw);}window.stopFixtureAnimation=()=>running=false;draw();</script>':''));
});
let context,worker,origin;
async function launch(name,dpr=1){
 const profile=path.join(work,name),downloads=path.join(work,name+'-downloads');
 fs.mkdirSync(downloads,{recursive:true});fs.mkdirSync(path.join(profile,'Default'),{recursive:true});
 const preferences=path.join(profile,'Default','Preferences');
 if(!fs.existsSync(preferences))fs.writeFileSync(preferences,JSON.stringify({download:{default_directory:downloads,prompt_for_download:false,directory_upgrade:true}}));
 context=await chromium.launchPersistentContext(profile,{executablePath,headless:process.env.GULIR_HEADED!=='1',viewport:null,acceptDownloads:false,args:['--window-size=1280,720','--force-device-scale-factor='+dpr,'--disable-extensions-except='+extension,'--load-extension='+extension]});
 context.setDefaultTimeout(15000);
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
 await worker.evaluate(async id=>{const t=await chrome.tabs.get(id);await chrome.windows.update(t.windowId,{focused:true});await chrome.tabs.update(id,{active:true});},tabId);let active;for(let attempt=0;attempt<100;attempt++){active=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,lastFocusedWindow:true}))[0]?.id);if(active===tabId)break;await new Promise(r=>setTimeout(r,25));}assert.equal(active,tabId,'capture must model the active-tab user flow');
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
async function dimensions(preview){return preview.locator('img').evaluateAll(imgs=>imgs.map(i=>[i.naturalWidth,i.naturalHeight]));}
async function save(preview,name,folder){
 await preview.locator('#name').fill(name);await preview.locator('#folder').fill(folder);
 await preview.locator('#save').click();
 await preview.waitForFunction(()=>document.getElementById('status').textContent.includes('berhasil'));
 const items=await preview.evaluate(()=>chrome.downloads.search({orderBy:['-startTime']}));
 assert.equal(items[0].state,'complete');assert.ok(fs.existsSync(items[0].filename));
 return items[0].filename;
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 const downloads=await launch('standard');
 const page=await pageAt('/short'),preview=await invoke(page);
 assert.match(await preview.locator('#summary').innerText(),/3200 px/);
 assert.deepEqual(await dimensions(preview),[[1280,3200]]);
 record('real debugger capture and popup preview, 1280x3200');
 const filename=await save(preview,'test-shot','Screenshots/Test');
 assert.equal(filename,path.join(downloads,'Screenshots','Test','test-shot.png'));
 const original=crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
 record('native PNG filename, subfolder and download completion');
 await preview.screenshot({path:path.join(work,'preview.png')});await preview.close();
 const repeated=await invoke(page);
 assert.equal(await repeated.locator('#folder').inputValue(),'Screenshots/Test');
 const duplicate=await save(repeated,'test-shot','Screenshots/Test');
 assert.equal(duplicate,path.join(downloads,'Screenshots','Test','test-shot (1).png'));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),original);
 record('repeat capture detaches debugger; duplicate download preserves original');await repeated.close();
 const longPage=await pageAt('/long'),longPreview=await invoke(longPage);
 assert.deepEqual(await dimensions(longPreview),[[1280,35000]]);
 const samples=await longPreview.locator('img').evaluate(img=>{
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

 await longPreview.locator('#folder').fill('../bad');await longPreview.locator('#save').click();
 await longPreview.waitForFunction(()=>document.getElementById('status').textContent.includes('tidak valid'));
 assert.equal(await longPreview.locator('#save').isEnabled(),true);
 record('folder traversal rejected and retry remains available');
 const longFile=await save(longPreview,'long-shot','Screenshots/Test');
 assert.equal(path.basename(longFile),'long-shot.png');
 const longDownloads=await longPreview.evaluate(()=>chrome.downloads.search({filenameRegex:'long-shot'}));
 assert.equal(longDownloads.length,1,'only one download for long page');
 record('35000px single file download without numbered parts');

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
 const gridSamples=await grid.locator('img').evaluate(img=>{
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
 const growingPage=await pageAt('/growing'),growing=await invoke(growingPage,true);
 assert.match(await growing.locator('#status').innerText(),/Ukuran halaman berubah/);
 assert.equal(await growingPage.evaluate(()=>getComputedStyle(document.querySelector('#sticky')).position),'sticky');
 assert.equal(await growingPage.evaluate(()=>getComputedStyle(document.querySelector('#fixed')).opacity),'0.8');
 record('growing page rejects without partial output and restores sticky state');await growing.close();
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
 await context.close();context=null;
 await launch('standard');
 const restored=await invoke(await pageAt('/short?restart'));
 assert.equal(await restored.locator('#folder').inputValue(),'Screenshots/Test');
 record('folder preference survives browser restart');
 await context.close();context=null;
 await launch('retina',2);
 const retinaPage=await pageAt('/short?retina');
 assert.equal(await retinaPage.evaluate(()=>devicePixelRatio),2);
 const retina=await invoke(retinaPage);
 assert.deepEqual(await dimensions(retina),[[1280,3200]]);
 record('Retina/deviceScaleFactor 2: one output pixel per CSS pixel');
 if(process.env.GULIR_TALL==='1'){
  await context.close();context=null;await launch('tall');
  const tall=await invoke(await pageAt('/tall'));
  assert.deepEqual(await dimensions(tall),[[1280,70001]]);
  const tallSamples=await tall.locator('img').evaluate(img=>{
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
