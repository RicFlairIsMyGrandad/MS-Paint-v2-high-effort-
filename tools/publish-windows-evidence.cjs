// Publish only isolated CI fixtures/results to a unique evidence branch.
// This never changes main and uses the runner's normal checkout credentials.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), cp = require("node:child_process");
const run = process.env.GITHUB_RUN_ID;
const targetOS=process.env.PAINTPLUS_CI_TARGET || "windows";
if(!/^[a-z0-9-]+$/.test(targetOS))throw new Error("Invalid CI target.");
if (!run || !/^[0-9]+$/.test(run)) throw new Error("This helper is only for GitHub CI.");
const target = "ci-evidence";
fs.mkdirSync(target, {recursive:true});
const paths = ["docs/ui-test-results.json", "docs/packaged-windows-test-results.json", "docs/portable-windows-test-results.json", "docs/screenshots/packaged-windows.png", "windows-core-tests.log", "windows-ui-tests.log", "windows-packaged-tests.log", "test-results"];
for (const file of paths) if (fs.existsSync(file)) fs.cpSync(file, path.join(target,path.basename(file)), {recursive:true});
fs.writeFileSync(path.join(target,"runner.json"), JSON.stringify({run,source:process.env.GITHUB_SHA,platform:process.platform,architecture:process.arch,os:os.version(),release:os.release(),node:process.version},null,2));
const git = args => cp.execFileSync("git",args,{stdio:"inherit"});
git(["config","user.name","github-actions[bot]"]);
git(["config","user.email","41898282+github-actions[bot]@users.noreply.github.com"]);
git(["add","-f",target]);
git(["commit","-m",`Windows CI evidence for ${process.env.GITHUB_SHA}`]);
git(["push","origin",`HEAD:refs/heads/windows-evidence-${run}-${targetOS}`]);
