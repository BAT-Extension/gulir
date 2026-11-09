// Never close a window or browser. Only remove this verified extension tab.
export async function closePreviewOnly(tabs=globalThis.chrome?.tabs,currentUrl=globalThis.location?.href,previewUrl=globalThis.chrome?.runtime?.getURL('preview.html')) {
  if(!tabs?.getCurrent||!tabs?.query||!tabs?.remove)return false;
  const current=await tabs.getCurrent();
  if(!Number.isInteger(current?.id)||current.id<0||(current.url!==undefined&&current.url!==currentUrl))return false;
  // Chrome omits tab.url without broad tabs permission. getCurrent still
  // guarantees the ID belongs to this executing extension document.
  const url=new URL(currentUrl),expected=new URL(previewUrl);
  if(url.origin!==expected.origin||url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname)return false;
  // Keep Chrome open even if the user already closed every other tab/window.
  const all=await tabs.query({});
  if(!all.some(tab=>Number.isInteger(tab.id)&&tab.id!==current.id))return false;
  await tabs.remove(current.id);
  return true;
}
