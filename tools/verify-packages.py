"""Check final NSIS/portable archives against the exact release candidate."""
from pathlib import Path
import hashlib,json,os,re,shutil,subprocess,tempfile
root=Path(__file__).resolve().parents[1];version=json.loads((root/'package.json').read_text())['version'];candidate=json.loads(Path(f'/tmp/paintplus-candidate-{version}.json').read_text())
seven=os.environ.get('PAINTPLUS_7Z')or shutil.which('7z')or '/workspace/.cache/native/usr/lib/7zip/7z';out=Path(tempfile.mkdtemp(prefix='paintplus-integrity-'))
def run(args):return subprocess.check_output(args,cwd=root,text=True,stderr=subprocess.STDOUT)
def entries(archive):return re.findall(r'^Path = (.+)$',run([seven,'l','-slt',str(archive)]),re.M)
def extract(archive,entry,dest):
 dest.mkdir(parents=True,exist_ok=True);run([seven,'e',str(archive),entry,f'-o{dest}','-y']);return dest/Path(entry.replace('\\','/')).name

def digest(file):
 with file.open('rb')as f:return hashlib.file_digest(f,'sha256').hexdigest()
summary={'version':version,'sourceRevision':candidate['sourceRevision'],'files':{}}
for name,expected in candidate['files'].items():
 file=root/'release'/name;assert digest(file)==expected and file.stat().st_size<104857600
 assert 'Everything is Ok'in run([seven,'t',str(file)])
 summary['files'][name]={'bytes':file.stat().st_size,'sha256':expected}
setup=root/f'release/PaintPlus-Setup-{version}-x64.exe';portable=root/f'release/PaintPlus-Portable-{version}-x64.exe'
setup_asar=extract(setup,next(e for e in entries(setup)if e.endswith('resources/app.asar')),out/'setup')
inner=extract(portable,next(e for e in entries(portable)if e.endswith('app-64.7z')),out/'inner');assert 'Everything is Ok'in run([seven,'t',str(inner)])
portable_asar=extract(inner,next(e for e in entries(inner)if e.endswith('resources/app.asar')),out/'portable');app=root/'release/win-unpacked/resources/app.asar'
assert digest(setup_asar)==digest(portable_asar)==digest(app)==candidate['appAsarSha256']
script="""const a=require('@electron/asar'),crypto=require('crypto'),p=process.argv[1],read=n=>a.extractFile(p,n);const fonts=a.listPackage(p).filter(x=>/\\.(woff2|ttf)$/.test(x));if(fonts.length!==7||!fonts.some(x=>x.endsWith('grade-wobble.ttf')))throw Error('Bundled font missing');console.log(JSON.stringify({asarVersion:JSON.parse(read('package.json')).version,bundledFontCount:fonts.length,bundledModelSha256:crypto.createHash('sha256').update(read('dist/models/u2netp.onnx')).digest('hex'),handwritingFontSha256:crypto.createHash('sha256').update(read('dist/fonts/grade-wobble.ttf')).digest('hex')}));"""
metadata=json.loads(run(['node','-e',script,str(app)]));assert metadata['asarVersion']==version
atlas=json.loads((root/'assets/lettering/grade-mouse-samples.json').read_text())
check="""const a=require('@electron/asar'),fs=require('fs'),p=process.argv[1],atlas=JSON.parse(fs.readFileSync('assets/lettering/grade-mouse-samples.json'));const code=a.listPackage(p).filter(n=>/dist[\\/]assets[\\/].*\\.js$/.test(n)).map(n=>a.extractFile(p,n.replace(/^[/\\\\]/,'' )).toString()).join('\\n');for(const c of ['A','a','0'])for(const g of atlas.glyphs[c])if(!code.includes(g.alpha))throw Error('User lettering sample missing from installed app');"""
run(['node','-e',check,str(app)])
summary.update({'mouseLetteringCharacters':len(atlas['glyphs']),'mouseLetteringVariants':sum(map(len,atlas['glyphs'].values())),'userGlyphsInPackagedCode':True,'mouseLetteringAtlasSha256':digest(root/'assets/lettering/grade-mouse-samples.json')})
summary.update({'setupArchiveIntegrity':True,'portableArchiveIntegrity':True,'portableInnerPayloadIntegrity':True,'setupAndPortableAsarMatch':True,'appAsarSha256':digest(app),**metadata})
(root/f'docs/packaging-integrity-{version}.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
