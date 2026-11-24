# edk2-webflash

WebUSB flasher for [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) UEFI on Rockchip RK3576.
It runs in the browser, with no app to install and no USB passthrough.
It wraps [rkdeveloptool](https://github.com/rockchip-linux/rkdeveloptool) compiled to WASM with Emscripten.

**Live: https://flash.gahingwoo.com/**

Requires Chrome or Edge (WebUSB). No drivers on Linux and macOS.
Windows: install WinUSB for the device with [Zadig](https://zadig.akeo.ie/).

New to these boards? Start at
[edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576#from-a-new-board-to-windows-or-linux)
([简体中文](https://github.com/gahingwoo/edk2-rk3576/blob/main/README.zh-CN.md)):
it has the whole path from a new board to Windows or Linux. The same writes,
and a Windows install without a USB stick, are in the desktop app
[Maskrom Studio](https://github.com/gahingwoo/maskrom-studio).

## Usage

The page is a three-step wizard.

1. **Board**: Radxa ROCK 4D, ArmSoM CM5-IO or LCKFB TaishanPi 3M.
2. **Firmware**: one of the choices in the table below, and where the UEFI
   image comes from (see [Release channels](#release-channels)).
3. **Write**: the page lists what will be written and where, and how to put
   the board into MaskROM. Click **Connect and write** and pick the Rockchip
   device from the browser prompt. The loader is sent and the board comes back
   as a new USB device; click **Choose the board** and pick it again. The
   image is written and the board is reset.

| Board | Choice | Written |
|---|---|---|
| ROCK 4D | UEFI firmware | `ROCK4D-spi-edk2-<ver>.img` to the SPI NOR, from sector 0 |
| ROCK 4D | Mainline U-Boot | `rock4d-spi-uboot.img` to the SPI NOR, from sector 0 |
| CM5-IO | UEFI firmware, whole image | `CM5IO-emmc-edk2-<ver>.img` to the eMMC, from sector 0 |
| CM5-IO | UEFI firmware, keep the partitions | sectors 64 to 43647 of the same image, to sector 64 |
| CM5-IO | Mainline U-Boot | `cm5io-sdcard-uboot.img` to the eMMC, from sector 0 |
| TaishanPi 3M | UEFI firmware, whole image | `TaishanPi3M-emmc-edk2-<ver>.img` to the eMMC, from sector 0 |
| TaishanPi 3M | UEFI firmware, keep the partitions | sectors 64 to 43647 of the same image, to sector 64 |
| any | A file from this computer | the file, from sector 0 |

The whole eMMC images carry a partition table, so they replace an installed
system. "Keep the partitions" writes only the firmware and is for an eMMC that
was set up with the whole image before. It stops at sector 43648, where the
FIT's nvdata slot holds the saved UEFI settings; the image carries that slot
empty, so writing it would reset them. Before writing, the page reads the FIT
in the image and refuses the write if nvdata does not start there; the offsets are the ones in
edk2-rk3576's [flashing page](https://edk2.gahingwoo.com/flash.html#updating-the-firmware-and-keeping-everything-else),
which uses the same range for its `rkdeveloptool` and `dd` commands. A file
larger than the ROCK 4D's 16 MiB SPI NOR is refused.

### Release channels

The UEFI images come from one of three channels of edk2-rk3576, chosen on the
Firmware step, as in Maskrom Studio:

| Channel | What it is |
|---|---|
| Release (default) | the [latest release](https://github.com/gahingwoo/edk2-rk3576/releases/latest) |
| Pre-release | the newest release by version, pre-releases included; the same files as Release when no pre-release is newer |
| CI build | the rolling [`ci` pre-release](https://github.com/gahingwoo/edk2-rk3576/releases/tag/ci), which edk2-rk3576's build workflow replaces after every successful build of main |

A CI build has not been run on a board. The page says so, shows the commit it
was built from and when, and writes it only after a box saying so is ticked.
"Keep the partitions" writes the same range, sectors 64 to 43647, from every
channel, and the nvdata check runs on every image, so the saved UEFI settings
stay whichever channel is written.

Every image is checked twice: at deploy time against its release's
`SHA256SUMS.txt`, and in the browser, after the download and before the board
is touched, against the size and SHA-256 that `firmware.json` records for it.

The page is in English and Simplified Chinese: the browser's language, or the
button in the masthead.

The TaishanPi 3M has no MaskROM button: two pads marked `MSK` are shorted while
powering on, or F4 is pressed during the boot countdown of a board that
already runs this firmware.

Why the device is picked twice: after `DownloadBoot` the SoC resets and
re-enumerates. WebUSB drops the old handle, and `requestDevice()` has to be
called from a click, which the second button provides.

## How it works

```
index.html            the page: PatternFly 6 Page, Masthead and Wizard markup
src/app.js            the wizard and what it shows (main thread)
src/boards.js         boards, their choices, sectors and wording
src/i18n.js           English and Chinese wording, and the language choice
src/flash.js          the write sequence, with everything it touches passed in
src/proxy.js          Promise-based Worker RPC wrapper
src/worker.js         Dedicated Worker: WASM host, WORKERFS mount manager
src/theme.js          light or dark from localStorage.theme, else the system
assets/app.css        page CSS on top of PatternFly
assets/patternfly/    the PatternFly parts the page uses, built by build.sh
scripts/bundle-firmware.py   downloads the images of the three channels at deploy time
tests/flash.test.html browser tests of src/flash.js against fakes
tests/browser.py      runs those tests in headless Chrome (CI), or takes a screenshot
tests/test_bundle.py  tests of the bundler's channel choice
dist/                 CI-built artefacts (not in tree)
  rkdeveloptool.js    Emscripten glue
  rkdeveloptool.wasm
rock4d-spi-edk2.img   CI-bundled from the latest edk2-rk3576 release (not in tree)
cm5io-emmc-edk2.img
tspi3m-emmc-edk2.img
prerelease/*.img      the same names, when the Pre-release channel is a different release
ci/*.img              the same names, from the rolling ci release
firmware.json         per channel: the release, its commit for CI, and each
                      image's file, version, size and SHA-256
coi-serviceworker.js  Retrofits COOP/COEP for SharedArrayBuffer on static hosts
CMakeLists.wasm.txt   WASM build definition
```

The write sequence (MaskROM path):

```
1. Fetch rk3576_spl_loader.bin and the board's image in parallel, same origin
2. requestDevice(): the user selects the MaskROM-mode device
3. Await the downloads, check the image's size and SHA-256 against
   firmware.json, cut the part to write if the choice writes a part,
   check sizes, mount the Blobs into WASM WORKERFS
4. rkdeveloptool db: send the SPL loader; the SoC resets into loader mode
5. The user clicks Choose the board: requestDevice() again
6. rkdeveloptool wl <sector>: stream the image to the SPI NOR or the eMMC
7. rkdeveloptool rd: reset
```

**Threading model:** rkdeveloptool is compiled with ASYNCIFY (no pthreads).
The WASM module runs in a Dedicated Worker for WORKERFS access.
`coi-serviceworker.js` enables `SharedArrayBuffer` so libusb can use
`Atomics.waitAsync` instead of a spin-poll, keeping ASYNCIFY fiber state intact.

## Working on the page

Serve the repository root (`python3 -m http.server`) and open it at
`http://localhost:8000/`; WebUSB and the service worker need localhost or
HTTPS. `dist/` is built by CI: copy `rkdeveloptool.js` and `rkdeveloptool.wasm`
from the live site into `dist/` to run the page locally.
`tests/flash.test.html`, opened the same way, runs the write sequence against
a fake tool and a fake USB device and prints PASS or FAIL for each check.
CI runs it in headless Chrome with `python3 tests/browser.py test
http://localhost:8000/tests/flash.test.html`, and the bundler's tests with
`python3 -m unittest discover -s tests`. To run the page with real images,
`python3 scripts/bundle-firmware.py <dir>` fills a directory the way CI does.

The PatternFly CSS is assembled from the npm package by
`assets/patternfly/build.sh`, which lists the components. To use another
component, add it there and run the script again. Do not edit
`patternfly-flash.css` by hand.

## Building

Requires Emscripten 3.1.48 and CMake. See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) for the exact steps. CI tests and builds every branch and deploys `main` to GitHub Pages.

The UEFI images are downloaded from edk2-rk3576's releases at deploy time by
`scripts/bundle-firmware.py`, checked against each release's
`SHA256SUMS.txt`, and served from this site. The page cannot fetch them from
GitHub directly: release downloads carry no CORS headers. Every hour the
workflow compares what the three channels point at with the `fingerprint` in
the live `firmware.json`, and rebuilds the site when a release was published or
the `ci` release was replaced. A new build therefore reaches the site within
about an hour, or at once with a manual run of the workflow. If the
Pre-release or CI channel cannot be bundled, it is left out and the page shows
it as unavailable; the Release channel failing stops the deploy.


## License

GPL-2.0. See [LICENSE](LICENSE).

| Dependency | License |
|---|---|
| rkdeveloptool | GPL-2.0 |
| libusb 1.0.29 | LGPL-2.1 |
| coi-serviceworker | MIT |
| [PatternFly](https://www.patternfly.org/) 6 CSS and Red Hat fonts | MIT, OFL-1.1 |
| [edk2-rk3576](https://github.com/gahingwoo/edk2-rk3576) firmware | BSD-2-Clause-Patent |

