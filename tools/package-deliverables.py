"""Collect the built Windows downloads, source, evidence and SHA-256 manifest."""
from pathlib import Path
import hashlib
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path("/workspace/shared/downloads")
output.mkdir(parents=True, exist_ok=True)
source = output / "PaintPlus-Source-1.0.0.zip"
folders = ("src", "desktop", "tests", "tools", "docs", "assets")
files = [root / name for name in ("README.md", "LICENSE", ".gitignore", "package.json", "package-lock.json", "index.html", "vite.config.mjs", "playwright.config.mjs")]
for folder in folders:
    files.extend(path for path in (root / folder).rglob("*") if path.is_file() and "__pycache__" not in path.parts)
files.extend(path for path in (root / "public" / "legal").rglob("*") if path.is_file())
files.append(root / "public" / "favicon.svg")
with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(files):
        archive.write(path, "PaintPlus/" + str(path.relative_to(root)))

deliveries = {
    "PaintPlus-Setup-1.0.0-x64.exe": root / "release" / "PaintPlus-Setup-1.0.0-x64.exe",
    "PaintPlus-Portable-1.0.0-x64.exe": root / "release" / "PaintPlus-Portable-1.0.0-x64.exe",
    "PaintPlus-Screenshot.png": root / "docs" / "screenshots" / "paintplus-final.png",
    "PaintPlus-Editor.png": root / "docs" / "screenshots" / "paintplus-desktop.png",
    "Example.paintplus": root / "docs" / "Example.paintplus",
    "Example.png": root / "docs" / "screenshots" / "example-export.png",
    "README.txt": root / "README.md",
    "Limitations.txt": root / "docs" / "LIMITATIONS.md",
    "Test-report.txt": root / "docs" / "TESTING.md",
}
for name, path in deliveries.items():
    shutil.copyfile(path, output / name)

with (output / "SHA256SUMS.txt").open("w") as manifest:
    for path in sorted(output.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS.txt":
            digest = hashlib.file_digest(path.open("rb"), "sha256").hexdigest()
            manifest.write(f"{digest}  {path.name}\n")
with zipfile.ZipFile(source) as archive:
    assert archive.testzip() is None
    assert "PaintPlus/assets/ai/u2netp.onnx" in archive.namelist()
    assert "PaintPlus/docs/TESTING.md" in archive.namelist()
    assert not any("node_modules/" in name for name in archive.namelist())
print(f"Verified source archive: {source.stat().st_size:,} bytes, {len(files)} files")
for path in sorted(output.iterdir()):
    print(f"{path.name}: {path.stat().st_size:,} bytes")
