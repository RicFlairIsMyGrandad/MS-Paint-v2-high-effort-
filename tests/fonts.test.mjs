import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createFontCatalog,registryNames}=createRequire(import.meta.url)('../desktop/fonts.cjs');
test('font catalog shares one slow native lookup across concurrent editor requests',async()=>{
 let calls=0,finish;const catalog=createFontCatalog({platform:'win32',environment:{SystemRoot:'D:\\Windows'},execute:(command,args,options,callback)=>{calls++;assert.equal(command,'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');assert.equal(options.timeout,30000);finish=callback;}});
 const first=catalog(),second=catalog();assert.equal(calls,1);finish(null,'Segoe UI\r\nArial\r\nSegoe UI\r\n');assert.deepEqual(await first,['Arial','Segoe UI']);assert.equal(first,second);assert.deepEqual(await catalog(),['Arial','Segoe UI']);assert.equal(calls,1);
});
test('failed Windows GDI enumeration falls back to machine and user font registration',async()=>{
 const calls=[],events=[];const catalog=createFontCatalog({platform:'win32',execute:(command,args,options,callback)=>{calls.push(args);if(command.endsWith('powershell.exe'))callback(new Error('timed out'),'');else if(args[1].startsWith('HKLM'))callback(null,'    Arial (TrueType)    REG_SZ    arial.ttf\r\n    Arial Bold (TrueType)    REG_SZ    arialbd.ttf\r\n    Cambria & Cambria Math (TrueType)    REG_SZ    cambria.ttc');else callback(null,'    User Font (OpenType)    REG_SZ    C:\\Fonts\\custom.otf');},report:(event,detail)=>events.push({event,...detail})});
 assert.deepEqual(await catalog(),['Arial','Cambria','Cambria Math','User Font']);assert.equal(calls.length,3);assert.equal(events.at(-1).source,'registry');assert.equal(events.at(-1).count,4);
});
test('font parsing keeps Unicode and real family names and handles a missing native catalog',async()=>{
 assert.deepEqual(registryNames('HKEY_LOCAL_MACHINE\\Fonts\r\n    Arial Black (TrueType)    REG_SZ    ariblk.ttf\r\n    游ゴシック (TrueType)    REG_SZ    yugothic.ttf'),['Arial Black','游ゴシック']);
 const catalog=createFontCatalog({platform:'linux',execute:(command,args,options,callback)=>{assert.equal(command,'fc-list');callback(new Error('not installed'),'');}});assert.deepEqual(await catalog(),[]);
});
