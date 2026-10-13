// Brand the unsigned Windows PE resources before installer compression. This
// works on Linux and Windows without Wine or a signing certificate.
const fs = require('node:fs');
const path = require('node:path');
async function brandExecutable(executable, iconFile, version) {
  const PE = await import('pe-library'), ResEdit = await import('resedit');
  const exe = PE.NtExecutable.from(fs.readFileSync(executable),{ignoreCert:true}), resources = PE.NtExecutableResource.from(exe);
  const icons = ResEdit.Data.IconFile.from(fs.readFileSync(iconFile));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  for(const group of groups.length?groups:[{id:101,lang:1033}]) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries,group.id,group.lang,icons.icons.map(item=>item.data));
  const versions = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  for(const info of versions) {
    info.setFileVersion(version+'.0',1033);info.setProductVersion(version+'.0',1033);
    info.setStringValues({lang:1033,codepage:1200},{FileDescription:'PaintPlus',ProductName:'PaintPlus',InternalName:'PaintPlus',OriginalFilename:'PaintPlus.exe',CompanyName:'PaintPlus contributors'});
    info.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(exe);fs.writeFileSync(executable,Buffer.from(exe.generate()));
}
module.exports = async context => {
  if(context.electronPlatformName!=='win32')return;
  await brandExecutable(path.join(context.appOutDir,context.packager.appInfo.productFilename+'.exe'),path.join(context.packager.projectDir,'assets/icon.ico'),context.packager.appInfo.version);
};
module.exports.brandExecutable=brandExecutable;
