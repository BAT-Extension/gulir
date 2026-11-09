// FileSystemDirectoryHandle exposes a name, not its absolute OS path.
// Never construct a guessed Downloads/home path or imply a saved handle is the
// destination in ordinary picker mode.
const relativePath=location=>(location.directoryName||'Folder yang dipilih')+' / '+location.fileName;
const pathLimit='Lokasi relatif di folder pilihan, bukan path lengkap perangkat. Chrome hanya memberi nama folder.';
export function describeSaveLocation({preferences={},fileName='',selected=null,permission='unknown'}={}) {
  let path,detail;
  if(selected){
    path=relativePath(selected);detail='Folder tujuan sudah dipilih. '+pathLimit;
  }else if(!preferences.enabled){
    path='Pilih folder saat Simpan PNG';detail='Tujuan belum ditentukan untuk screenshot ini. '+pathLimit;
  }else if(!preferences.directoryHandle){
    path='Belum ada folder tersimpan';detail='Pilih folder saat penyimpanan pertama. '+pathLimit;
  }else{
    path=relativePath({directoryName:preferences.directoryHandle.name,fileName});
    const access=permission==='granted'?'Izin folder tersedia.':permission==='prompt'?'Konfirmasi izin diperlukan saat simpan.':permission==='denied'?'Izin folder tidak tersedia; pilih folder lagi saat simpan.':'Izin folder akan diperiksa saat simpan.';
    detail='Folder tersimpan. '+access+' '+pathLimit;
  }
  const lastSaved=preferences.lastSavedLocation?'Terakhir disimpan: '+relativePath(preferences.lastSavedLocation):'';
  return {path,detail,lastSaved};
}
