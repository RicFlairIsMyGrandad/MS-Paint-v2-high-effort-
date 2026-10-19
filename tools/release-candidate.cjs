// Publish exact binaries for the native CI checks; run after a committed source build.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),version=require(path.join(root,'package.json')).version;
const git=(args,options={})=>cp.execFileSync('git',args,{cwd:root,...options}),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(git(['status','--porcelain','--','src','desktop','public','assets','package.json','package-lock.json','index.html','vite.config.mjs']).length)throw Error('Commit application changes before publishing a candidate.');
const inputPaths=['src','desktop','public','assets','package.json','package-lock.json','index.html','vite.config.mjs'];
const candidate={version,sourceRevision:git(['rev-parse','HEAD']).toString().trim(),appSourceSha256:sha(git(['ls-tree','-r','HEAD','--',...inputPaths])),appAsarSha256:sha(fs.readFileSync('release/win-unpacked/resources/app.asar')),files:{}};
const names=['Setup','Portable'].map(kind=>`PaintPlus-${kind}-${version}-x64.exe`);
for(const name of names){const bytes=fs.readFileSync(path.join('release',name));if(bytes.length>=104857600)throw Error('Executable exceeds the GitHub file limit');candidate.files[name]=sha(bytes);}
const folder=fs.mkdtempSync('/tmp/paintplus-candidate-'),metadata=path.join(folder,'Candidate.json');fs.writeFileSync(metadata,JSON.stringify(candidate,null,2));
const env={...process.env,GIT_INDEX_FILE:path.join(folder,'index')};git(['read-tree','HEAD'],{env});
for(const name of git(['ls-tree','-r','--name-only','HEAD','--','downloads']).toString().trim().split('\n'))if(name)git(['update-index','--force-remove',name],{env});
for(const [file,name]of [...names.map(name=>[path.join('release',name),name]),[metadata,'Candidate.json']]){const blob=git(['hash-object','-w',file]).toString().trim();git(['update-index','--add','--cacheinfo',`100644,${blob},downloads/${name}`],{env});}
const tree=git(['write-tree'],{env}).toString().trim(),branch=`refs/heads/paintplus-candidate-${version}`;
const existing=git(['ls-remote','origin',branch]).toString().trim().split(/\s+/)[0];if(existing)git(['fetch','origin',branch]);
const commit=git(['commit-tree',tree,...(existing?['-p',existing,'-p','HEAD']:['-p','HEAD']),'-m',`PaintPlus ${version} exact executable candidates`]).toString().trim();
fs.copyFileSync(metadata,`/tmp/paintplus-candidate-${version}.json`);console.log(JSON.stringify({commit,...candidate},null,2));git(['push','origin',`${commit}:${branch}`],{stdio:'inherit'});
