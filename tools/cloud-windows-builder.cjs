// Linux cloud compression may exceed builder-util's fixed four-minute NSIS limit.
// Extend only that subprocess budget; preserve all compiler flags, inputs and errors.
const path=require('node:path'),{spawn}=require('node:child_process'),util=require('builder-util');
const original=util.spawnAndWrite;
util.spawnAndWrite=(command,args,data,options)=>{
 if(!['makensis','makensis.exe'].includes(path.basename(command)))return original(command,args,data,options);
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{...options,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',expired=false;
  const timer=setTimeout(()=>{expired=true;child.kill('SIGKILL');},15*60*1000);
  child.stdout.on('data',chunk=>{stdout=(stdout+chunk).slice(-4*1024*1024);});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4*1024*1024);});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',(code,signal)=>{clearTimeout(timer);if(code===0&&!signal)resolve();else reject(new Error(`NSIS compiler failed: exit ${code}, signal ${signal}${expired?' (15 minute build limit)':''}\n${stdout}\n${stderr}`));});
  child.stdin.on('error',error=>{clearTimeout(timer);reject(error);});child.stdin.end(data);
 });
};
require('electron-builder/out/cli/cli.js');
