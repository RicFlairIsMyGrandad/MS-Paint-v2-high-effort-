# Third-party code and model provenance

PaintPlus code is MIT licensed. Original demo illustrations were generated for
this application; the SVG assets and icon were drawn specifically for it.
No Microsoft Paint logos, proprietary icon files or screenshot artwork are used.

| Component | Version / source | License |
| --- | --- | --- |
| Electron | 38.2.0, official GitHub release | MIT; embedded Chromium notices also included |
| ONNX Runtime Web | 1.22.0, registry.npmjs.org package with lockfile integrity | MIT |
| U2Net architecture / code | xuebinqin/U-2-Net | Apache 2.0 |
| U2NetP ONNX conversion / distribution | danielgatis/rembg, release v0.0.0 | rembg MIT; model architecture Apache 2.0 |
| Vite, Playwright, electron-builder | Pinned in package.json and lockfile, build/test tools | MIT / Apache 2.0; not runtime Node modules |
| @napi-rs/canvas | 0.1.80, raster test tool | MIT; not included in Windows app |

Model URL:
https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx

Model SHA-256:
`309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`

Its MD5 `8e83ca70e441ab06c318d82300c84806` was also compared to the checksum
published in rembg's U2NetP session implementation. Download TLS verification was
retained. This is the small 4.6 MB CPU-capable model, not a remote API.

Electron archive SHA-256 hashes, compared with its official SHASUMS256.txt:

```text
f0028975282a6f2946797175ac406a95096f29c5dcda98048148668dfa36eff8  electron-v38.2.0-linux-x64.zip
4382b317dbbbc0bbf8a301304749324b88207218aac240b670f1c1247c2a02b0  electron-v38.2.0-win32-x64.zip
```

License texts are bundled in `public/legal/` (copied into the application) and
Electron's LICENSE / LICENSES.chromium.html are included in its distribution.
No runtime package-signature, artifact-checksum or TLS verification was disabled.

## Bundled fonts in 1.0.3

Caveat, Inter, Lora, Merriweather, Pacifico and Roboto Mono come from the
Google Fonts source repository under SIL Open Font License 1.1. Each font's
license, source URL and SHA-256 is included in assets/fonts. The bundled WOFF2
files are Latin subsets, with punctuation and currency characters. Derived
family names are prefixed PaintPlus; Merriweather pins width and optical size
while preserving variable weight. Other characters use the installed font
fallback. System fonts are enumerated locally and are not redistributed.

The new palette/brush app icon was generated for this release at the user's
request. Its full-resolution source is in assets/design and the Windows ICO
and PNG derivatives are in assets. Windows PE branding uses resedit 3.0.2 and
pe-library 2.0.1 (MIT), only during the build.
