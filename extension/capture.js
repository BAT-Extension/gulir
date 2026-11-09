// Capture real viewport pixels, never an oversized compositor surface.
import {encodePng} from './png.js';
import {captureDimensions} from './core.js';
import {expandScrollableContent} from './expand.js';
import {settleLazyPage} from './settle.js';
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
export async function captureSinglePng(send, getZoom) {
  try { return await captureAttempt(send, getZoom); }
  catch (error) {
    // Never merge strips from two geometries. Retry the entire image once only
    // after the first attempt restored the page, with bounded lazy-load settling.
    if (error.code !== 'PAGE_SIZE_CHANGED') throw error;
    return captureAttempt(send, getZoom, true);
  }
}
async function captureAttempt(send, getZoom, settle = false) {
  const startFrame=(await send('Page.getFrameTree')).frameTree.frame;
  const {executionContextId:contextId}=await send('Page.createIsolatedWorld',{frameId:startFrame.id,worldName:'gulir-'+crypto.randomUUID()});
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,contextId,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error('Halaman tidak dapat disiapkan untuk screenshot.');
    return result.result?.value;
  };
  let prepared=false, failure;
  const started=Date.now();
  try {
    prepared=true;
    await evaluate(`(()=>{
      const state={x:scrollX,y:scrollY,changed:[],fixed:[],stylePresence:new Map()};
      globalThis.__gulirCapture=state;
      state.restore=()=>{
        if(state.cleaned)return;
        state.cleaned=true;
        state.expansionRestored=globalThis.__gulirExpansion?.restore()??state.expansionPreparationRestored??{restored:true,errors:[]};
        clearTimeout(state.timer);removeEventListener('pagehide',state.restore);
        for(const item of state.fixed){if(item.value)item.el.style.setProperty('opacity',item.value,item.priority);else item.el.style.removeProperty('opacity');}
        // Commit original opacity while transitions are still disabled, so
        // restoring the author's transition does not fade the page back in.
        for(const item of state.fixed)void getComputedStyle(item.el).opacity;
        scrollTo({left:state.x,top:state.y,behavior:'instant'});
        for(const item of [...state.changed].reverse()){if(item.prop==='transition-property')void getComputedStyle(item.el).opacity;if(item.value)item.el.style.setProperty(item.prop,item.value,item.priority);else item.el.style.removeProperty(item.prop);}
        for(const [el,present] of state.stylePresence)if(present===false&&!el.getAttribute('style')?.trim())el.removeAttribute('style');
        scrollTo({left:state.x,top:state.y,behavior:'instant'});
        delete globalThis.__gulirCapture;
      };
      // Restore synchronously before a document enters back/forward cache, and
      // eventually after an unexpected service-worker/debugger interruption.
      addEventListener('pagehide',state.restore,{once:true});
      state.timer=setTimeout(state.restore,300000);
      const set=(el,prop,value)=>{
        if(!state.stylePresence.has(el))state.stylePresence.set(el,el.hasAttribute?.('style'));
        state.changed.push({el,prop,value:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)});
        el.style.setProperty(prop,value,'important');
      };
      for(const el of [document.documentElement,document.body].filter(Boolean)){
        set(el,'scroll-behavior','auto');set(el,'scroll-snap-type','none');set(el,'overflow-anchor','none');
      }
      function viewportFixed(el){
        for(let p=el.parentElement||el.getRootNode().host;p;p=p.parentElement||p.getRootNode().host){
          const c=getComputedStyle(p);
          if(c.transform!=='none'||c.perspective!=='none'||c.filter!=='none'||
             ['translate','rotate','scale'].some(prop=>c[prop]&&c[prop]!=='none')||
             c.backdropFilter!=='none'||/(layout|paint|strict|content)/.test(c.contain)||
             /(transform|perspective|filter)/.test(c.willChange)||c.contentVisibility==='auto')return false;
        }
        return true;
      }
      function visit(root){
        for(const el of root.querySelectorAll('*')){
          const pos=getComputedStyle(el).position;
          if(pos==='sticky'){
            // Sticky headers often shrink on scroll. Keep their original flow
            // footprint so later strips do not shift upward. min-height still
            // permits real content growth, which the size guard must reject.
            const rect=el.getBoundingClientRect?.();
            if(rect&&Number.isFinite(rect.height)&&rect.height>0){
              const c=getComputedStyle(el),extras=(parseFloat(c.paddingTop)||0)+(parseFloat(c.paddingBottom)||0)+(parseFloat(c.borderTopWidth)||0)+(parseFloat(c.borderBottomWidth)||0);
              set(el,'padding-top',c.paddingTop);set(el,'padding-bottom',c.paddingBottom);
              set(el,'min-height',Math.max(0,rect.height-(c.boxSizing==='border-box'?0:extras))+'px');
            }
            set(el,'transition-property','none');
            set(el,'position','relative');
            for(const prop of ['top','right','bottom','left'])set(el,prop,'auto');
          }else if(pos==='fixed'&&viewportFixed(el)&&!state.fixed.some(item=>item.el===el)){
            set(el,'transition-property','none');
            state.fixed.push({el,value:el.style.getPropertyValue('opacity'),priority:el.style.getPropertyPriority('opacity')});
          }
          if(el.shadowRoot)visit(el.shadowRoot);
        }
      }
      state.refresh=()=>visit(document);
      visit(document);
      return true;
    })()`);
    if(settle){const readiness=await evaluate(`(${settleLazyPage.toString()})()`);if(!readiness?.ok)throw Error(readiness?.error||'Halaman belum stabil. Tidak ada gambar sebagian yang disimpan.');}
    const expansion=await evaluate(`(${expandScrollableContent.toString()})()`);
    if(!expansion?.ok){
      if(expansion?.restored===false)await evaluate('globalThis.__gulirCapture.expansionPreparationRestored={restored:false}');
      throw Error(expansion?.error||'Area scroll tidak dapat diperluas dengan aman.');
    }
    await wait(350); // Allow the debugger banner to settle before measuring.
    const initial=await evaluate('({width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight,dpr:devicePixelRatio})');
    const zoom=await getZoom(),dpr=initial.dpr;
    if(!Number.isFinite(dpr)||dpr<=0||!Number.isFinite(zoom)||zoom<=0)throw Error('Skala layar atau zoom tidak valid.');
    const size=(await send('Page.getLayoutMetrics')).cssContentSize;
    if((size.x||0)<0||(size.y||0)<0)throw Error('Halaman dengan area gulir negatif belum didukung. Tidak ada gambar sebagian yang disimpan.');
    captureDimensions(size.width,size.height); // Shared finite dimensions and resource limits.
    const width=Math.ceil(size.width),height=Math.ceil(size.height);
    const bandHeight=Math.floor(Math.min(initial.clientHeight-4,initial.height-4,1024,4000000/width));
    const availableWidth=Math.floor(Math.min(initial.clientWidth,initial.width));
    const tileWidth=width<=availableWidth?width:availableWidth-4;
    if(bandHeight<1||tileWidth<1||Math.ceil(width/tileWidth)*Math.ceil(height/bandHeight)>1200)throw Error('Viewport terlalu kecil untuk screenshot ini. Perbesar jendela browser lalu ulangi.');
    if(initial.width*initial.height*dpr*dpr>32000000)throw Error('Viewport terlalu besar untuk batas memori aman.');
    let lastX=0,lastY=0,cancelled=false;
    const check=async()=>{
      if(Date.now()-started>300000)throw Error('Pengambilan melebihi 5 menit. Tidak ada gambar sebagian yang disimpan.');
      const frame=(await send('Page.getFrameTree')).frameTree.frame;
      const current=(await send('Page.getLayoutMetrics')).cssContentSize;
      const state=await evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,x:scrollX,y:scrollY,visibility:document.visibilityState,capturing:!!globalThis.__gulirCapture,expansion:globalThis.__gulirExpansion?.check()})');
      if(!state.expansion?.ok)throw Error(state.expansion?.error||'Area scroll berubah selama screenshot.');
      if(!state.capturing)throw Error('Pengambilan dibatalkan sebelum selesai. Tidak ada gambar sebagian yang disimpan.');
      if(state.visibility!=='visible')throw Error('Tab tidak aktif. Pertahankan tab ini di depan selama screenshot.');
      if(frame.loaderId!==startFrame.loaderId||frame.url!==startFrame.url)throw Error('Halaman berpindah saat screenshot. Ulangi pada halaman yang stabil.');
      if(current.width!==size.width||current.height!==size.height){const error=Error('Ukuran halaman berubah saat screenshot. Muat semua konten lalu ulangi.');error.code='PAGE_SIZE_CHANGED';throw error;}
      if(state.dpr!==dpr||await getZoom()!==zoom||state.width!==initial.width||state.height!==initial.height)throw Error('Ukuran viewport atau zoom berubah saat screenshot. Ulangi.');
      return state;
    };
    async function* strips(){
      const canvas=new OffscreenCanvas(width,bandHeight),ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw Error('Canvas untuk menggabungkan screenshot tidak tersedia.');
      ctx.imageSmoothingQuality='high';
      let firstBitmap;
      try{
      for(let y=0;y<height;y+=bandHeight){
        const rows=Math.min(bandHeight,height-y);ctx.clearRect(0,0,width,bandHeight);
        for(let x=0;x<width;x+=tileWidth){
          if(cancelled)throw Error('Penggabungan PNG dibatalkan.');
          const cols=Math.min(tileWidth,width-x);
          const state=await evaluate(`(async()=>{
            const s=globalThis.__gulirCapture;if(!s||s.cleaned)throw Error('Capture expired');
            s.refresh();
            if(${y}>0||${x}>0)for(const item of s.fixed){if(getComputedStyle(item.el).position!=='fixed')continue;item.el.style.setProperty('opacity','0','important');if(Number(getComputedStyle(item.el).opacity)!==0)throw Error('Fixed overlay could not be hidden');}
            scrollTo({left:${Math.max(0,x-2)},top:${Math.max(0,y-2)},behavior:'instant'});
            await new Promise(r=>{setTimeout(r,250);requestAnimationFrame(()=>requestAnimationFrame(r));});
            return {x:scrollX,y:scrollY};
          })()`);
          lastX=state.x;lastY=state.y;
          // Wait for raster work after scrolling, without requiring an animated page to freeze.
          await wait(60);
          // A scroll handler may insert a new fixed overlay after our first scan.
          // Hide it before rasterizing this strip, and restore it with the rest.
          if(y>0||x>0)await evaluate(`(()=>{const s=globalThis.__gulirCapture;if(!s||s.cleaned)throw Error('Capture expired');s.refresh();for(const item of s.fixed){if(getComputedStyle(item.el).position!=='fixed')continue;item.el.style.setProperty('opacity','0','important');if(Number(getComputedStyle(item.el).opacity)!==0)throw Error('Fixed overlay could not be hidden');}})()`);
          const before=await check();
          if(before.x!==lastX||before.y!==lastY)throw Error('Halaman digulir saat screenshot. Jangan gulir sampai selesai.');
          if(cancelled)throw Error('Penggabungan PNG dibatalkan.');
          const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
          const bytes=Uint8Array.from(atob(shot.data),c=>c.charCodeAt(0));
          const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
          try {
            // innerWidth/innerHeight round fractional CSS viewports; use DPR for exact crop geometry.
            const rx=dpr,ry=dpr;
            if(bitmap.width*bitmap.height>32000000||Math.abs(bitmap.width-initial.width*dpr)>Math.ceil(dpr)||Math.abs(bitmap.height-initial.height*dpr)>Math.ceil(dpr))throw Error('Ukuran viewport PNG tidak sesuai.');
            const sx=(x-lastX)*rx,sy=(y-lastY)*ry;
            if(sx<0||sy<0||sx+cols*rx>bitmap.width+0.01||sy+rows*ry>bitmap.height+0.01)throw Error('Browser tidak menggulir ke area screenshot yang diminta.');
            ctx.drawImage(bitmap,sx,sy,cols*rx,rows*ry,x,0,cols,rows);
            // Keep the complete first viewport, including bottom/right fixed UI.
            // Reuse its original pixels across band boundaries, not only tile 0.
            if(!firstBitmap)firstBitmap=bitmap;
            else {
              const coverWidth=Math.min(width,initial.clientWidth,firstBitmap.width/dpr);
              const coverHeight=Math.min(height,initial.clientHeight,firstBitmap.height/dpr);
              const cw=Math.min(cols,coverWidth-x),ch=Math.min(rows,coverHeight-y);
              if(cw>0&&ch>0)ctx.drawImage(firstBitmap,x*dpr,y*dpr,cw*dpr,ch*dpr,x,0,cw,ch);
            }
          } finally {if(bitmap!==firstBitmap)bitmap.close();}
          const after=await check();
          if(after.x!==lastX||after.y!==lastY)throw Error('Halaman digulir saat screenshot. Jangan gulir sampai selesai.');
        }
        yield {width,height:rows,data:ctx.getImageData(0,0,width,rows).data};
      }
      }finally{firstBitmap?.close();}
    }
    const source=strips();let blob;
    try{blob=await encodePng({width,height,strips:source});}
    finally{cancelled=true;await source.return();}
    await check();
    return {width,height,blob,captureInfo:{expandedContainers:expansion.expandedContainers,expandedFrames:expansion.expandedFrames,warnings:expansion.warnings||[]}};
  } catch(e){failure=e;throw e;}
  finally {
    if(prepared){
      try {
        const restored=await evaluate(`(async()=>{
          const s=globalThis.__gulirCapture;if(!s)return {restored:true};
          scrollTo({left:s.x,top:s.y,behavior:'instant'});
          await new Promise(r=>{setTimeout(r,250);requestAnimationFrame(()=>requestAnimationFrame(r));});
          s.restore();
          await new Promise(r=>{setTimeout(r,250);requestAnimationFrame(()=>requestAnimationFrame(r));});
          return {restored:s.expansionRestored?.restored!==false&&Math.abs(scrollX-s.x)<0.01&&Math.abs(scrollY-s.y)<0.01};
        })()`);
        if(!restored?.restored)throw Error('Posisi gulir tidak pulih.');
      } catch(e){throw Error((failure?failure.message+' ':'')+'Screenshot dibatalkan karena tampilan asal tidak dapat dipastikan pulih. Muat ulang halaman jika tampilannya berubah.');}
    }
  }
}
