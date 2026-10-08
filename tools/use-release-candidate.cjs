// Native CI tests the exact downloadable EXEs when a matching candidate exists.
// Otherwise it uses the EXEs it just built. Candidates require matching app inputs.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const version = require('../package.json').version;
const ref = `paintplus-candidate-${version}`;
const base = `https://raw.githubusercontent.com/RicFlairIsMyGrandad/MS-Paint-v2-high-effort-/${ref}/downloads/`;
const appInputs = ['src', 'desktop', 'public', 'assets', 'package.json', 'package-lock.json', 'index.html', 'vite.config.mjs'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const response = await fetch(base + 'Candidate.json');
  if (response.status === 404) {
    fs.writeFileSync('docs/windows-release-candidate.json', JSON.stringify({ version, source: 'native build; no published candidate' }, null, 2));
    return;
  }
  if (!response.ok) throw new Error(`Candidate lookup failed: ${response.status}`);
  const candidate = await response.json();
  const inputs = cp.execFileSync('git', ['ls-tree', '-r', 'HEAD', '--', ...appInputs]);
  if (candidate.version !== version || candidate.appSourceSha256 !== sha(inputs)) throw new Error('Published candidate does not match the current application sources. Refresh the candidate or bump the version.');
  for (const kind of ['Setup', 'Portable']) {
    const name = `PaintPlus-${kind}-${version}-x64.exe`;
    const download = await fetch(base + name);
    if (!download.ok) throw new Error(`Candidate download failed: ${name}: ${download.status}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    if (sha(bytes) !== candidate.files[name]) throw new Error(`Candidate checksum failed: ${name}`);
    fs.writeFileSync(path.join('release', name), bytes);
  }
  fs.writeFileSync('docs/windows-release-candidate.json', JSON.stringify({ version, source: 'exact published candidate', ref, ...candidate }, null, 2));
  console.log(`Verified the exact ${version} Setup and Portable candidate EXEs.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
