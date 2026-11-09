// Serialized into the isolated world. Only used after a size-change rejection.
export async function settleLazyPage() {
  const start=Date.now(), url=location.href, deadline=20000;
  const initial={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
  let steps=0,last=null;
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const size=()=>({width:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),height:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)});
  const valid=()=>{
    if(!globalThis.__gulirCapture||globalThis.__gulirCapture.cleaned||location.href!==url||document.visibilityState!=='visible')throw Error('Persiapan dibatalkan karena tab/halaman berubah.');
    if(innerWidth!==initial.width||innerHeight!==initial.height||devicePixelRatio!==initial.dpr)throw Error('Viewport berubah saat menyiapkan screenshot.');
    const s=size();
    if(Date.now()-start>deadline||steps>240||s.width>16000||s.height>120000||s.width*s.height>120000000)throw Error('Halaman terus memuat atau terlalu besar. Tidak ada gambar sebagian yang disimpan.');
    return s;
  };
  try {
    for(let pass=0;pass<3;pass++){
      let position=0;
      while(true){
        const s=valid();
        scrollTo({left:0,top:position,behavior:'instant'});steps++;
        await pause(80);valid();
        if(position>=size().height-innerHeight)break;
        position=Math.min(position+Math.max(1,innerHeight-40),size().height-innerHeight);
      }
      // Decode already requested images/fonts without waiting forever for network.
      await Promise.race([Promise.allSettled([document.fonts?.ready,...[...document.images].filter(i=>i.currentSrc).map(i=>i.decode().catch(()=>{}))]),pause(1000)]);
      scrollTo({left:0,top:0,behavior:'instant'});await pause(500);
      const now=valid();
      if(last&&now.width===last.width&&now.height===last.height){
        await pause(400);const final=valid();
        if(now.width===final.width&&now.height===final.height)return {ok:true};
      }
      last=now;
    }
    throw Error('Halaman belum stabil setelah persiapan. Tidak ada gambar sebagian yang disimpan.');
  }catch(error){return {ok:false,error:error.message};}
}
