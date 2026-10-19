"""Download every final public artifact and compare the published SHA-256 manifest."""
from pathlib import Path
import concurrent.futures,hashlib,json,subprocess,tempfile,zipfile
root=Path(__file__).resolve().parents[1];version=json.loads((root/'package.json').read_text())['version'];revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
folder=Path(tempfile.mkdtemp(prefix=f'paintplus-public-{version}-'));base=f'https://github.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/raw/{revision}/downloads/'
def download(name):
 out=folder/name;subprocess.run(['curl','--fail','--silent','--show-error','--location','--retry','2','--max-time','180',base+name,'--output',str(out)],check=True);return out
entries=[line.split('  ',1)for line in download('SHA256SUMS.txt').read_text().splitlines()if line.strip()]
def verify(entry):
 expected,name=entry;p=download(name)
 with p.open('rb')as f:assert hashlib.file_digest(f,'sha256').hexdigest()==expected,name
 return {'file':name,'bytes':p.stat().st_size,'sha256':expected}
with concurrent.futures.ThreadPoolExecutor(max_workers=5)as e:results=list(e.map(verify,entries))
candidate=json.loads(Path(f'/tmp/paintplus-candidate-{version}.json').read_text())
for r in results:
 if r['file']in candidate['files']:assert r['sha256']==candidate['files'][r['file']]
with zipfile.ZipFile(folder/f'PaintPlus-Source-{version}.zip')as z:
 assert z.testzip()is None
 for name in ['src/app.js','src/core/selection.js','src/core/shortcuts.js','src/core/document.js','assets/fonts/grade-wobble.ttf','tools/build-handwriting-font.py','tests/ui/wand-feedback.spec.mjs','docs/TESTING.md']:assert z.read('PaintPlus/'+name)==(root/name).read_bytes()
assert (folder/'PaintPlus-Full-Source.txt').read_text().startswith('PAINTPLUS '+version)
assert (folder/'Grade-Wobble.ttf').read_bytes()[:4]==b'\x00\x01\x00\x00'
for name in ['Grade-Wobble-Specimen.pdf','Handwriting-Template.pdf']:assert (folder/name).read_bytes().startswith(b'%PDF-')
(folder/'verified-downloads.json').write_text(json.dumps({'revision':revision,'files':results},indent=2)+'\n');print(f'All {len(results)} public downloads matched their SHA-256 values; source ZIP CRC and font/PDF checks passed.');print('Evidence:',folder);print(json.dumps([r for r in results if r['file'].endswith('.exe')],indent=2))
