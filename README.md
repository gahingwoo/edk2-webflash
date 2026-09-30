# edk2-webflash

WebUSB flasher for [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) UEFI on Rockchip RK3576.
Runs entirely in the browser — no app, no driver, no USB passthrough.
Wraps [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool) compiled to WASM via Emscripten.

**Live: https://flash.gahingwoo.com/**

Requires Chrome or Edge (WebUSB). No drivers on Linux / macOS.
Windows: install WinUSB for the device via [Zadig](https://zadig.akeo.ie/).

---

## Usage

1. Pick the board: **ROCK 4D** or **CM5 IO**
2. Hold the **MaskROM button**, plug in USB-C, release
3. Click **Flash UEFI** → pick the Rockchip device from the browser prompt
4. Loader uploads, board reboots → click **Reconnect Device** → pick device again
5. Firmware flashes, board reboots into UEFI

| Board | Written to | Image |
|---|---|---|
| ROCK 4D | SPI NOR | `ROCK4D-spi-edk2-<ver>.img` from the latest edk2-rk3576 release |
| CM5 IO | eMMC | `CM5IO-emmc-edk2-<ver>.img` from the latest edk2-rk3576 release |

**Flash U-Boot** writes mainline U-Boot instead. **Flash Custom Image** writes
any image you pick from disk.

> **Why two device picks?**
> After `DownloadBoot` the SoC resets and re-enumerates. WebUSB invalidates
> the old handle on disconnect, and `requestDevice()` requires a user gesture
> — it cannot be called from an async continuation. The button provides that gesture.

---

## How it works

```
index.html            UI + flash sequencer (main thread)
src/proxy.js          Promise-based Worker RPC wrapper
src/worker.js         Dedicated Worker — WASM host, WORKERFS mount manager
dist/                 CI-built artefacts (not in tree)
  rkdeveloptool.js    Emscripten glue
  rkdeveloptool.wasm
rock4d-spi-edk2.img   CI-bundled from the latest edk2-rk3576 release (not in tree)
cm5io-emmc-edk2.img
edk2-version.txt      which release was bundled; shown on the page
coi-serviceworker.js  Retrofits COOP/COEP for SharedArrayBuffer on static hosts
CMakeLists.wasm.txt   WASM build definition
```

Flash sequence (MaskROM path):

```
① Fetch rk3576_spl_loader.bin + the board's image in parallel, same origin
② requestDevice()  — user selects MaskROM-mode device
③ Await downloads, mount Blobs into WASM WORKERFS
④ rkdeveloptool db  — send SPL loader; SoC resets → Loader mode
⑤ User clicks Reconnect Device → requestDevice() → Loader-mode handle
⑥ rkdeveloptool wl 0  — stream the image: SPI NOR on ROCK 4D, eMMC on CM5 IO
⑦ rkdeveloptool rd  — reset
```

**Threading model:** rkdeveloptool is compiled with ASYNCIFY (no pthreads).
The WASM module runs in a Dedicated Worker for WORKERFS access.
`coi-serviceworker.js` enables `SharedArrayBuffer` so libusb can use
`Atomics.waitAsync` instead of a spin-poll, keeping ASYNCIFY fiber state intact.

---

## Building

Requires Emscripten 3.1.48 and CMake. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the exact steps. CI builds and deploys to GitHub Pages on every push to `main`, and daily.

The UEFI images are downloaded from the latest
[edk2-rk3576 release](https://github.com/gahingwoo/edk2-rk3576/releases/latest)
at deploy time, checked against its `SHA256SUMS.txt`, and served from this
site. The page cannot fetch them from GitHub directly: release downloads carry
no CORS headers. A new release therefore reaches the site on the next daily
run, or at once with a manual run of the workflow.

---

## License

GPL-2.0. See [LICENSE](LICENSE).

| Dependency | License |
|---|---|
| rkdeveloptool | GPL-2.0 |
| libusb 1.0.29 | LGPL-2.1 |
| coi-serviceworker | MIT |
| [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) firmware | BSD-2-Clause-Patent |

