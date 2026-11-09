// Native user-selected save path, independent of Chrome download routing.
export async function writeFileHandle(handle, blob) {
  let writer;
  try{
    writer=await handle.createWritable();
    await writer.write(blob);
    await writer.close();
    return {name:handle.name};
  }catch(error){
    try{await writer?.abort();}catch{}
    throw error;
  }
}
export async function saveDirect(blob, name, picker = globalThis.showSaveFilePicker) {
  if(typeof picker!=='function')throw Error('Dialog simpan langsung tidak tersedia di browser ini.');
  // Keep picker invocation in the original click task for user activation.
  const handle=await picker.call(globalThis,{id:'gulir-screenshots',startIn:'downloads',suggestedName:name,
    types:[{description:'Gambar PNG',accept:{'image/png':['.png']}}],excludeAcceptAllOption:true});
  return writeFileHandle(handle,blob);
}
