"""Package only extension runtime; no source tests, profiles or user screenshots."""
from pathlib import Path
import hashlib,json,zipfile,stat
root=Path(__file__).resolve().parents[1]
source=root/'extension'; version=json.loads((source/'manifest.json').read_text())['version']
dest=root/'dist';dest.mkdir(exist_ok=True)
files=sorted(p for p in source.rglob('*') if p.is_file())
for p in files:
 assert not p.is_symlink(), 'Symlinks forbidden'
 assert p.suffix in {'.js','.html','.css','.json','.png','.svg'}, 'Unexpected runtime file'
name=f'gulir-{version}-candidate.zip'; target=dest/name
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,p.relative_to(source).as_posix())
with zipfile.ZipFile(target) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={p.relative_to(source).as_posix() for p in files}
 assert 'manifest.json' in z.namelist()
 for p in files:assert z.read(p.relative_to(source).as_posix())==p.read_bytes()
receipt={'file':name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'version':version,'status':'VERIFIED_ARCHIVE_NOT_PUBLICATION_APPROVAL','files':len(files),'known_blocker':'JNE real-page clipping failure remains unverified'}
(dest/(name+'.sha256')).write_text(receipt['sha256']+'  '+name+'\n')
(dest/'package-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
