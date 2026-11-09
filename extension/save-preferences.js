import {preferenceOp} from './db.js';
import {writeFileHandle} from './save-direct.js';

const enabledKey='remember-save-folder';
const directoryKey='save-directory-handle';
const lastSaveKey='last-saved-location';

// Lock all Gulir preview tabs while choosing a free name and committing the write.
// File System Access has no exclusive-create primitive: external apps can still race us.
export async function saveInDirectory(blob,name,directory,locks=globalThis.navigator?.locks,onDestination=()=>{}) {
  if(!locks?.request)throw Error('Simpan cepat tidak tersedia: penguncian file tidak didukung. Matikan opsi folder terakhir untuk memakai dialog simpan.');
  return locks.request('gulir-save-directory',async()=>{
    const dot=name.lastIndexOf('.');
    const base=dot>0?name.slice(0,dot):name,extension=dot>0?name.slice(dot):'';
    for(let i=0;i<10000;i++){
      const candidate=i?base+' ('+i+')'+extension:name;
      try{
        // Check either file OR directory without treating permission/I/O errors as absence.
        try{await directory.getFileHandle(candidate);continue;}
        catch(error){
          if(error.name==='TypeMismatchError')continue;
          if(error.name!=='NotFoundError')throw error;
        }
        const handle=await directory.getFileHandle(candidate,{create:true});
        onDestination({directoryName:directory.name||'',fileName:handle.name||candidate});
        return await writeFileHandle(handle,blob);
      }catch(error){throw error;}
    }
    throw Error('Terlalu banyak nama file yang sama. Gunakan nama lain.');
  });
}

export function createSavePreferences({
  storage=preferenceOp,
  directoryPicker=(...args)=>globalThis.showDirectoryPicker(...args),
  locks=globalThis.navigator?.locks
}={}) {
  return {
    async loadSavePreferences(){
      const [enabled,directoryHandle,lastSavedLocation]=await Promise.all([storage('get',enabledKey),storage('get',directoryKey),storage('get',lastSaveKey)]);
      const validLocation=typeof lastSavedLocation?.directoryName==='string'&&typeof lastSavedLocation?.fileName==='string';
      return {enabled:enabled===true,directoryHandle:directoryHandle||null,lastSavedLocation:validLocation?lastSavedLocation:null};
    },
    async setRememberFolder(enabled){
      await storage('put',enabledKey,enabled===true);
    },
    // Call only from the user's Save/Enter action with preferences already loaded.
    async saveWithPreferences(blob,name,preferences,{onDestination=()=>{}}={}){
      const finish=async directory=>{
        const result=await saveInDirectory(blob,name,directory,locks,onDestination);
        const lastSavedLocation={directoryName:directory.name||'',fileName:result.name};
        // A history-write failure must never turn a committed PNG into a failed
        // save or cause the user to create an accidental duplicate by retrying.
        let locationRemembered=true;
        try{await storage('put',lastSaveKey,lastSavedLocation);}catch{locationRemembered=false;}
        return {...result,directoryName:directory.name||'',preferences:{...preferences,lastSavedLocation},locationRemembered};
      };
      if(!preferences?.enabled){
        // Folder chooser never supplies or changes the filename. The preview name
        // is authoritative, with the same non-overwriting suffix rule in all modes.
        const directory=await directoryPicker({id:'gulir-save-folder',startIn:preferences?.directoryHandle||'downloads',mode:'readwrite'});
        return finish(directory);
      }
      let directory=preferences.directoryHandle;
      let permitted=false;
      if(directory?.kind==='directory'){
        try{
          let state=await directory.queryPermission({mode:'readwrite'});
          if(state==='prompt')state=await directory.requestPermission({mode:'readwrite'});
          permitted=state==='granted';
        }catch(error){
          if(error.name!=='NotAllowedError'&&error.name!=='SecurityError')throw error;
        }
      }
      if(!permitted){
        // showSaveFilePicker cannot expose its parent folder. Obtain explicit folder consent.
        directory=await directoryPicker({id:'gulir-save-folder',startIn:'downloads',mode:'readwrite'});
        await storage('put',directoryKey,directory);
        preferences.directoryHandle=directory;
      }
      return finish(directory);
    }
  };
}
const defaults=createSavePreferences();
export const loadSavePreferences=defaults.loadSavePreferences;
export const setRememberFolder=defaults.setRememberFolder;
export const saveWithPreferences=defaults.saveWithPreferences;
