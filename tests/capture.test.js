import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {captureDimensions} from '../extension/core.js';
const source=(await fs.readFile(new URL('../extension/capture.js',import.meta.url),'utf8'))
 .replace("import {encodePng} from './png.js';",'const encodePng=(args)=>globalThis.testEncode(args);')
 .replace("import {captureDimensions} from './core.js';",'const {captureDimensions}=globalThis.testCore;')
 .replace("import {settleLazyPage} from './settle.js';",'const settleLazyPage=()=>({ok:true});')
 .replace("import {expandScrollableContent} from './expand.js';",'const expandScrollableContent=()=>{globalThis.__gulirExpansion={check:()=>({ok:true}),restore:()=>({restored:true})};return {ok:true,expandedContainers:0,expandedFrames:0,warnings:[]};};')
 .replace('const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));','const wait = async()=>{};');
globalThis.testCore={captureDimensions};
const {captureSinglePng}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function style(initial={}){
 const values=new Map(Object.entries(initial).map(([k,v])=>[k,{value:v,priority:'important'}]));
 return {getPropertyValue:k=>values.get(k)?.value||'',getPropertyPriority:k=>values.get(k)?.priority||'',setProperty:(k,v,p)=>values.set(k,{value:v,priority:p}),removeProperty:k=>values.delete(k),values};
}
function fixture(mode='success'){
 let shots=0,restored=false,closed=0,attempts=0,measurements=0;const draw=[];
 const html={style:style({'scroll-behavior':'smooth'}),clientWidth:400,clientHeight:300};
 const fixed={style:style({visibility:'visible',opacity:'0.8'}),parentElement:null,getRootNode:()=>({}),kind:'fixed'};
 const sticky={style:style({top:'10px'}),kind:'sticky'};
 const doc={documentElement:html,body:null,visibilityState:'visible',querySelectorAll:()=>[fixed,sticky]};
 const context=vm.createContext({document:doc,scrollX:31,scrollY:41,innerWidth:400,innerHeight:300,devicePixelRatio:1.25,
  getComputedStyle:el=>({position:el.kind||'static',opacity:el.style?.getPropertyValue('opacity')||'1',transform:'none',filter:'none',backdropFilter:'none',perspective:'none',contain:'none',willChange:'auto',contentVisibility:'visible'}),
  requestAnimationFrame:f=>f(),setTimeout:()=>{},clearTimeout:()=>{},addEventListener:()=>{},removeEventListener:()=>{},Math,Promise,Error});
 context.scrollTo=({left,top})=>{context.scrollX=Math.min(Math.max(0,left),503);context.scrollY=Math.min(Math.max(0,top),mode==='resize-once'?1000:907);};
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;}getContext(){return {clearRect(){},drawImage:(...args)=>draw.push(args.slice(1)),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};}};
 globalThis.createImageBitmap=async()=>{
  if(mode==='decode-fail')throw Error('decode failed');
  return {width:500,height:375,close:()=>closed++};
 };
 globalThis.testEncode=async({width,height,strips})=>{
  let rows=0;for await(const part of strips){rows+=part.height;if(mode==='encode-fail')throw Error('budget exceeded');}
  assert.equal(width,903);assert.equal(rows,height);return new Blob(['one']);
 };
 const send=async(method,params)=>{
  if(method==='Page.getFrameTree')return {frameTree:{frame:{id:'frame',loaderId:mode==='navigation'&&shots?'new':'initial',url:'https://example.org'}}};
  if(method==='Page.createIsolatedWorld'){attempts++;return {executionContextId:7};}
  if(method==='Page.getLayoutMetrics')return {cssContentSize:{width:903,height:mode==='unstable-resize'?1207+measurements++:['resize','resize-once'].includes(mode)&&shots?1300:1207}};
  if(method==='Runtime.evaluate'){
   try{const value=await vm.runInContext(params.expression,context);if(!context.__gulirCapture)restored=true;return {result:{value}};}
   catch(e){return {exceptionDetails:{text:e.message}};}
  }
  if(method==='Page.captureScreenshot'){
   assert.equal(params.captureBeyondViewport,false);assert.equal(params.clip,undefined);shots++;
   if(mode==='capture-fail')throw Error('capture failed');
   if(mode==='scroll-change')context.scrollY+=1;
   if(mode==='pagehide')context.__gulirCapture.restore();
   if(mode==='inactive')doc.visibilityState='hidden';
   if(mode==='zoom-change')context.devicePixelRatio=2;
   return {data:Buffer.from('mock viewport').toString('base64')};
  }
 };
 return {send,zoom:async()=>1.25,state:()=>({shots,restored,closed,draw,context,html,fixed,sticky,attempts})};
}
for(const mode of ['success','resize-once','unstable-resize','capture-fail','decode-fail','encode-fail','navigation','resize','scroll-change','zoom-change','pagehide','inactive']){
 test('viewport pipeline preserves state and never oversized-captures: '+mode,async()=>{
  const f=fixture(mode);
  if(mode==='success'||mode==='resize-once'){
   const result=await captureSinglePng(f.send,f.zoom);
   assert.equal(result.height,mode==='resize-once'?1300:1207);assert.equal(result.width,903);assert.ok(result.blob instanceof Blob);
  }else if(mode==='unstable-resize')await assert.rejects(captureSinglePng(f.send,f.zoom),/Kode PAGE_SIZE: 903x[0-9]+ → 903x[0-9]+, viewport=400x300, dpr=1.25, retry=1/);
  else await assert.rejects(captureSinglePng(f.send,f.zoom));
  const s=f.state();assert.equal(s.restored,true);assert.ok(s.attempts<=2);if(mode==='resize-once')assert.equal(s.attempts,2);
  assert.equal(s.context.scrollX,31);assert.equal(s.context.scrollY,41);
  assert.equal(s.html.style.getPropertyValue('scroll-behavior'),'smooth');
  assert.equal(s.html.style.getPropertyPriority('scroll-behavior'),'important');
  assert.equal(s.fixed.style.getPropertyValue('visibility'),'visible');
  assert.equal(s.fixed.style.getPropertyValue('opacity'),'0.8');
  assert.equal(s.fixed.style.getPropertyPriority('opacity'),'important');
  assert.equal(s.sticky.style.getPropertyValue('position'),'');
  assert.equal(s.sticky.style.getPropertyValue('top'),'10px');
  assert.equal(s.sticky.style.getPropertyPriority('top'),'important');
  if(!['capture-fail','decode-fail'].includes(mode))assert.equal(s.closed,s.shots,'all decoded bitmaps released');
  for(const [sx,sy,sw,sh,dx,dy,dw,dh] of s.draw){
   assert.ok(sx>=0&&sy>=0&&sx+sw<=500.01&&sy+sh<=375.01,'only measured viewport pixels');
   assert.equal(sw/dw,1.25);assert.equal(sh/dh,1.25);
  }
 });
}
