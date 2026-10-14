const {execFile}=require('node:child_process');
const path=require('node:path');
const names=output=>[...new Set(String(output).replace(/^\uFEFF/,'').split(/[\r\n,]+/).map(name=>name.trim()).filter(name=>name&&name.length<100))].sort();
function registryNames(output){
  const families=[];
  for(const line of String(output).split(/\r?\n/)){
    const match=line.match(/^\s+(.+?)\s+REG_(?:EXPAND_)?SZ\s+/);
    if(!match)continue;
    for(const face of match[1].replace(/\s*\((?:TrueType|OpenType|All res)\)\s*$/i,'').split(/\s*&\s*/)){
      const family=face.replace(/^@/,'').replace(/\s+(?:Bold Italic|Bold Oblique|Regular|Bold|Italic|Oblique)$/i,'').trim();
      if(family)families.push(family);
    }
  }
  return names(families.join('\n'));
}
function createFontCatalog({platform=process.platform,execute=execFile,environment=process.env,report=()=>{}}={}){
  let pending;
  const run=(command,args)=>new Promise(resolve=>execute(command,args,{windowsHide:true,timeout:30000,maxBuffer:1024*1024,encoding:'utf8'},(error,output)=>resolve({error,output:output||''})));
  return ()=>pending ||= (async()=>{
    const windows=platform==='win32',systemRoot=environment.SystemRoot||environment.WINDIR||'C:\\Windows';
    const command=windows?path.win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'):'fc-list';
    const args=windows?['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object { $_.Name }"]:[':','family'];
    const result=await run(command,args),fonts=result.error?[]:names(result.output);
    if(fonts.length){report('font-catalog',{source:windows?'GDI':'fontconfig',count:fonts.length});return fonts;}
    report('font-catalog-primary-failed',{message:result.error?.message||'No font families returned'});
    if(!windows)return [];
    const registry=path.win32.join(systemRoot,'System32','reg.exe'),keys=['HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts','HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'];
    const results=await Promise.all(keys.map(key=>run(registry,['query',key])));
    const fallback=registryNames(results.filter(result=>!result.error).map(result=>result.output).join('\n'));
    report('font-catalog',{source:'registry',count:fallback.length});return fallback;
  })();
}
module.exports={createFontCatalog,registryNames};
