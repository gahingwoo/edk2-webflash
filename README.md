# edk2-webflash

WebUSB flasher for [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) UEFI on Rockchip RK3576 (Radxa ROCK 4D).
Runs entirely in the browser — no app, no driver, no USB passthrough.
Wraps [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool) compiled to WASM via Emscripten.

**Live: https://gahingwoo.github.io/edk2-webflash/**

Requires Chrome or Edge (WebUSB). No drivers on Linux / macOS.
Windows: install WinUSB for the device via [Zadig](https://zadig.akeo.ie/).

---

## Usage

1. Hold the **MaskROM button**, plug in USB-C, release
2. Click **Flash UEFI** → pick the Rockchip device from the browser prompt
3. Loader uploads, board reboots → click **Reconnect Device** → pick device again
4. Firmware flashes to SPI NOR, board reboots into UEFI

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
coi-serviceworker.js  Retrofits COOP/COEP for SharedArrayBuffer on static hosts
CMakeLists.wasm.txt   WASM build definition
```

Flash sequence (MaskROM path):

```
① Fetch rk3576_spl_loader.bin + rock4d-spi-edk2.img in parallel
② requestDevice()  — user selects MaskROM-mode device
③ Await downloads, mount Blobs into WASM WORKERFS
④ rkdeveloptool db  — send SPL loader; SoC resets → Loader mode
⑤ User clicks Reconnect Device → requestDevice() → Loader-mode handle
⑥ rkdeveloptool wl 0  — stream UEFI image to SPI NOR
⑦ rkdeveloptool rd  — reset
```

**Threading model:** rkdeveloptool is compiled with ASYNCIFY (no pthreads).
The WASM module runs in a Dedicated Worker for WORKERFS access.
`coi-serviceworker.js` enables `SharedArrayBuffer` so libusb can use
`Atomics.waitAsync` instead of a spin-poll, keeping ASYNCIFY fiber state intact.

---

## Building

Requires Emscripten 3.1.48 and CMake. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the exact steps. CI builds and deploys to GitHub Pages on every push to `main`.

---

## License

GPL-2.0. See [LICENSE](LICENSE).

| Dependency | License |
|---|---|
| rkdeveloptool | GPL-2.0 |
| libusb 1.0.29 | LGPL-2.1 |
| coi-serviceworker | MIT |
| [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) firmware | MIT |
