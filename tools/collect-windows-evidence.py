"""Verify both hosted Windows runners against the exact candidate and local suite.
Usage: python tools/collect-windows-evidence.py RUN SOURCE CORE_COUNT UI_COUNT
"""
from pathlib import Path
import concurrent.futures,hashlib,json,re,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1];run,source,core_count,ui_count=sys.argv[1:];core_count=int(core_count);ui_count=int(ui_count)
version=json.loads((root/'package.json').read_text())['version'];expected=json.loads(Path(f'/tmp/paintplus-candidate-{version}.json').read_text());assert expected['sourceRevision']==source
local=json.loads((root/'docs/packaged-linux-test-results.json').read_text());assert local['version']==version and local['rendererErrors']==local['externalRequests']==[]
flags=[key for key,value in local.items() if value is True]+['brandedExecutableIcons']
files=['runner.json','windows-core-tests.log','windows-ui-tests.log','windows-build-tests.log','windows-packaged-tests.log','ui-test-results.json','packaged-windows-test-results.json','portable-windows-test-results.json','windows-install-test-results.json','windows-uninstall-test-results.json','windows-release-candidate.json','packaged-windows.png','packaged-windows-dialog.png','packaged-windows-text.png','packaged-windows-lettering.png']
temporary=Path(f'/tmp/paintplus-windows-evidence-{version}');targets=['windows-2022','windows-latest'];repo='RicFlairIsMyGrandad/MS-Paint-v2-high-effort-'
def fetch(task):
 target,name=task;out=temporary/target/name;out.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run(['curl','--fail','--silent','--show-error','--location','--retry','2',f'https://raw.githubusercontent.com/{repo}/windows-evidence-{run}-{target}/ci-evidence/{name}','--output',str(out)],check=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6)as e:list(e.map(fetch,[(t,f)for t in targets for f in files]))
summary={'run':run,'source':source,'url':f'https://github.com/{repo}/actions/runs/{run}','version':version,'exactExecutableChecksums':expected['files'],'runners':[]}
for target in targets:
 folder=temporary/target
 def read(name):return json.loads((folder/name).read_bytes().decode('utf-8-sig'))
 runner=read('runner.json');assert runner['source']==source and runner['platform']=='win32' and runner['architecture']=='x64'
 stats=read('ui-test-results.json')['stats'];assert stats['expected']==ui_count and all(stats[k]==0 for k in ['skipped','flaky','unexpected'])
 log=re.sub(r'\x1b\[[0-9;]*m','',(folder/'windows-core-tests.log').read_text(encoding='utf-8-sig'))
 assert re.search(rf'tests\s+{core_count}\b',log)and re.search(rf'pass\s+{core_count}\b',log)and re.search(r'fail\s+0\b',log)
 app=read('packaged-windows-test-results.json');assert app['version']==version
 for flag in flags:assert app.get(flag)is True,(target,flag,app)
 assert app['fontCatalogSource']in ['GDI','registry']and app['fontCatalogCount']>6
 assert app['rendererErrors']==app['externalRequests']==[]and app['appPath'].endswith('app.asar')and app['gpuStatus']['gpu_compositing']!='enabled'
 portable=read('portable-windows-test-results.json');assert portable['version']==version
 for key in ['portableLauncher','clipboardOK','aiInferenceOK','collisionOK','aiModel']:assert portable[key]is True
 install=read('windows-install-test-results.json');assert install['setupExitCode']==0
 assert all(install[k]is True for k in ['payloadPresent','desktopShortcut','startMenuShortcut','projectAssociationCommand'])
 uninstall=read('windows-uninstall-test-results.json');assert all(v is True for v in uninstall.values())
 candidate=read('windows-release-candidate.json');assert candidate['source']=='exact published candidate'and candidate['files']==expected['files']and candidate['appSourceSha256']==expected['appSourceSha256']
 dest=root/'docs/windows-ci'/target;dest.mkdir(parents=True,exist_ok=True)
 for name in files:
  if not name.endswith('.png'):shutil.copyfile(folder/name,dest/name.replace('.log','.txt'))
 summary['runners'].append({'target':target,'os':runner['os'],'release':runner['release'],'corePassed':core_count,'uiPassed':ui_count,'installedPackagedChecksPassed':True,'portablePassed':True,'fontCatalogSource':app['fontCatalogSource'],'fontCatalogCount':app['fontCatalogCount'],'shortcutsAndAssociationPassed':True,'uninstallPreservedProject':True,'evidenceBranch':f'windows-evidence-{run}-{target}'})
for name in files:
 if name.startswith('packaged-windows')and name.endswith('.png'):shutil.copyfile(temporary/'windows-2022'/name,root/'docs/screenshots'/name)
for name in ['packaged-windows-test-results.json','portable-windows-test-results.json','windows-install-test-results.json','windows-uninstall-test-results.json','windows-release-candidate.json']:shutil.copyfile(temporary/'windows-2022'/name,root/'docs'/name)
(root/'docs/windows-test-evidence.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
