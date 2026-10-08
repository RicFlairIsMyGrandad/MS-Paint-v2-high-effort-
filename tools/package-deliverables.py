"""Collect the Windows build, complete source ZIP/TXT and SHA-256 manifest."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/workspace/shared/downloads")
output.mkdir(parents=True, exist_ok=True)
files = [root / name for name in ("README.md", "LICENSE", ".gitignore", "package.json", "package-lock.json", "index.html", "vite.config.mjs", "playwright.config.mjs")]
for folder in ("src", "desktop", "tests", "tools", "docs", "assets", ".github", "public"):
    files.extend(path for path in (root / folder).rglob("*") if path.is_file() and "__pycache__" not in path.parts and not (folder == "public" and path.relative_to(root / "public").parts[0] in {"demo", "models", "ort"}))
files = sorted(set(files))
source = output / f"PaintPlus-Source-{version}.zip"
with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in files:
        archive.write(file, "PaintPlus/" + str(file.relative_to(root)))

revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
text_files, binary = [], []
for file in files:
    data = file.read_bytes()
    if file.suffix.lower() in {".png", ".ico", ".onnx", ".paintplus"} or b"\0" in data:
        binary.append((file, data))
        continue
    try:
        text_files.append((file, data.decode("utf-8"), data))
    except UnicodeDecodeError:
        binary.append((file, data))
lines = [f"PAINTPLUS {version} — COMPLETE SOURCE CODE (TEXT EDITION)", f"Source revision: {revision}", f"Complete text files: {len(text_files)}", "", "Each section contains the original UTF-8 contents with its path and SHA-256.", "Binary artwork, AI model and example project are indexed below and included in", f"PaintPlus-Source-{version}.zip.", "", "TEXT FILE INDEX"]
lines.extend(str(file.relative_to(root)) for file, _, _ in text_files)
lines.extend(["", "BINARY ASSET INDEX (path | bytes | SHA-256)"])
lines.extend(f"{file.relative_to(root)} | {len(data)} | {hashlib.sha256(data).hexdigest()}" for file, data in binary)
parts = ["\n".join(lines) + "\n"]
for file, content, data in text_files:
    name = file.relative_to(root)
    parts.extend(["\n" + "=" * 80 + "\n", f"BEGIN FILE: {name}\nUTF-8 bytes: {len(data)}\nSHA-256: {hashlib.sha256(data).hexdigest()}\n", "=" * 80 + "\n", content])
    if not content.endswith("\n"):
        parts.append("\n")
    parts.append(f"\nEND FILE: {name}\n")
source_text = "".join(parts).encode("utf-8")
(output / "PaintPlus-Full-Source.txt").write_bytes(source_text)
assert len(re.findall(rb"^BEGIN FILE: ", source_text, flags=re.MULTILINE)) == len(text_files)
for file, _, data in text_files:
    begin = source_text.index(f"BEGIN FILE: {file.relative_to(root)}\n".encode())
    payload = source_text.index(("=" * 80 + "\n").encode(), begin) + 81
    assert source_text[payload:payload + len(data)] == data

deliveries = {
    f"PaintPlus-Setup-{version}-x64.exe": root / "release" / f"PaintPlus-Setup-{version}-x64.exe",
    f"PaintPlus-Portable-{version}-x64.exe": root / "release" / f"PaintPlus-Portable-{version}-x64.exe",
    "PaintPlus-Screenshot.png": root / "docs/screenshots/packaged-linux-dialog.png",
    "PaintPlus-Editor.png": root / "docs/screenshots/packaged-linux.png",
    "Example.paintplus": root / "docs/Example.paintplus",
    "Example.png": root / "docs/screenshots/example-export.png",
    "README.txt": root / "README.md",
    "Limitations.txt": root / "docs/LIMITATIONS.md",
    "Test-report.txt": root / "docs/TESTING.md",
    f"Release-{version}.txt": root / "docs" / f"RELEASE-{version}.md",
}
for name, file in deliveries.items():
    shutil.copyfile(file, output / name)
produced = [source.name, "PaintPlus-Full-Source.txt", *deliveries]
with (output / "SHA256SUMS.txt").open("w") as manifest:
    for name in sorted(produced):
        with (output / name).open("rb") as file:
            digest = hashlib.file_digest(file, "sha256").hexdigest()
        manifest.write(f"{digest}  {name}\n")
with zipfile.ZipFile(source) as archive:
    assert archive.testzip() is None
    for name in ("assets/ai/u2netp.onnx", "public/startup.js", "desktop/resources.cjs", "docs/TESTING.md", ".github/workflows/windows-check.yml"):
        assert "PaintPlus/" + name in archive.namelist()
    assert not any("node_modules/" in name for name in archive.namelist())
print(f"Verified source ZIP: {source.stat().st_size:,} bytes, {len(files)} files; TXT: {len(text_files)} complete files")
for name in sorted(produced):
    print(f"{name}: {(output / name).stat().st_size:,} bytes")
