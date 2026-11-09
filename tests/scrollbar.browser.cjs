const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname,'../extension/expand.js'),'utf8').replace('export async function','async function');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/home/putrimak/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 try {
  for(const box of ['border-box','content-box'])for(const decorated of [false,true]){
   const page=await browser.newPage({viewport:{width:800,height:600}});
   await page.setContent(`<style>body{margin:0}#panel{box-sizing:${box};width:400px;height:200px;overflow-x:scroll;overflow-y:auto;${decorated?'padding:9px 7px;border:3px solid black;':''}}#panel::-webkit-scrollbar{width:15px;height:15px}#data{height:1059px;background:linear-gradient(red,blue)}#bottom{height:20px;background:rgb(0,255,0)}</style><div id=panel><div id=data></div><div id=bottom></div></div>`);
   await page.evaluate(()=>document.querySelector('#panel').scrollTop=80);
   const snapshot=()=>page.evaluate(()=>{const p=document.querySelector('#panel');return{style:p.getAttribute('style'),scroll:p.scrollTop,height:p.offsetHeight,width:p.offsetWidth}});
   const before=await snapshot();
   assert.equal(await page.evaluate(()=>{const p=document.querySelector('#panel'),s=getComputedStyle(p);return p.offsetHeight-p.clientHeight-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth)}),15);
   const result=await page.evaluate(source+'; expandScrollableContent()');assert.equal(result.ok,true,JSON.stringify(result));
   assert.equal(await page.evaluate(()=>{const p=document.querySelector('#panel');return p.scrollHeight<=p.clientHeight+2}),true);
   const point=await page.evaluate(()=>{const r=document.querySelector('#bottom').getBoundingClientRect();return{x:Math.round(r.left+20),y:Math.round(r.top+10)}});
   const png=await page.screenshot({fullPage:true});
   const pixel=await page.evaluate(async({base64,point})=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(point.x,point.y,1,1).data]}, {base64:png.toString('base64'),point});
   assert.deepEqual(pixel,[0,255,0,255],'bottom strip must remain visible, not clipped');
   assert.equal((await page.evaluate(()=>globalThis.__gulirExpansion.check())).ok,true);
   // Subsequent growth must still fail; no tolerance was raised to hide clipping.
   await page.evaluate(()=>document.querySelector('#data').style.height='1400px');
   assert.equal((await page.evaluate(()=>globalThis.__gulirExpansion.check())).ok,false);
   await page.evaluate(()=>document.querySelector('#data').style.height='1059px');
   assert.equal((await page.evaluate(()=>globalThis.__gulirExpansion.restore())).restored,true);
   assert.deepEqual(await snapshot(),before);
   console.log(`PASS classic 15px scrollbar, ${box}, decorated=${decorated}: bottom pixels, growth rejection, exact restoration`);await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
