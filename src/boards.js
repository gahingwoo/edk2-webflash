// What this page can write on each board.
//
// Every write is "rkdeveloptool wl <lba> <file>" through the loader in
// rk3576_spl_loader.bin, which selects the SPI NOR on the ROCK 4D and the
// eMMC on the other two boards.
//
// A target with `slice` writes only part of the image file: `slice` is
// [first byte, end byte) of the file and `lba` is where that part belongs on
// the storage. The numbers come from edk2-rk3576's docs/FLASHING.md.
//
// A target with `image` is a UEFI image of edk2-rk3576. Which file that is
// depends on the release channel chosen on the page: withImage() puts the
// file, version and checksum from firmware.json in. The others are files of
// this site and are the same in every channel.
//
// Wording is L(English, Chinese); the page shows it with tr().
import { L } from './i18n.js?v=WASM_HASH';

const SECTOR = 512;
const MIB = 1024 * 1024;

// The eMMC layout edk2-rk3576 builds for the CM5-IO and the TaishanPi 3M:
// the SPL from sector 64, the FIT image from sector 16384, and inside the
// FIT, last, the 192 KiB "nvdata" slot that holds the saved UEFI settings.
// The image carries that slot empty (all 0xFF); the board fills it on its
// first boot. A write that keeps the settings stops where the slot starts.
// flash.js checks this against the FIT in the downloaded image, whichever
// channel it comes from.
const FIT_LBA = 16384;
const NVDATA_LBA = 43648;
const KEEP_SETTINGS = { fitLba: FIT_LBA, nvdataLba: NVDATA_LBA };

const BUTTON_STEPS = [
  L('Unplug the board from power.', '断开开发板电源。'),
  L('Hold the MaskROM button and plug the USB-C cable into this computer.', '按住 MaskROM 按键，把 USB-C 数据线插到这台电脑。'),
  L('Release the button.', '松开按键。'),
];

// The ROCK 4D's USB-C port only supplies power (its data pins are not
// connected); the download port is the USB-A port wired to the SoC's OTG
// controller, with a USB-A to USB-A cable.
const ROCK4D_STEPS = [
  L('Unplug the board from power.', '断开开发板电源。'),
  L('Connect a USB-A to USB-A cable from the board\'s upper USB 3.0 USB-A port to this computer. The USB-C port only supplies power.',
    '用 USB-A 转 USB-A 数据线把开发板上方的 USB 3.0 USB-A 口连接到这台电脑。USB-C 口只用于供电。'),
  L('Hold the MaskROM button and plug in the power supply on USB-C.', '按住 MaskROM 按键，在 USB-C 口接上电源。'),
  L('Release the button.', '松开按键。'),
];

const SPI = L('SPI NOR flash', 'SPI NOR 闪存');
const EMMC = L('eMMC', 'eMMC');

const UEFI_WHOLE = L('UEFI firmware, whole image', 'UEFI 固件，完整镜像');
const UEFI_KEEP = L('UEFI firmware, keep the partitions', 'UEFI 固件，保留分区');
const KEEP_NOTE = L('For an eMMC that already has this firmware and a system on it. Only the firmware is written.',
  '用于已装有此固件和系统的 eMMC。只写入固件。');

export const BOARDS = [
  {
    id: 'rock4d',
    name: 'Radxa ROCK 4D',
    storage: SPI,
    storageBytes: 16 * MIB,
    maskrom: ROCK4D_STEPS,
    targets: [
      {
        id: 'uefi', label: L('UEFI firmware', 'UEFI 固件'), image: 'rock4d', file: 'rock4d-spi-edk2.img', lba: 0,
        note: L('The edk2-rk3576 image for the SPI NOR flash. Linux and Windows 11 both start from it; Windows needs release 0.5.0 or later.',
          '用于 SPI NOR 闪存的 edk2-rk3576 镜像。Linux 和 Windows 11 都能从它启动；Windows 需要 0.5.0 或更新的正式版。'),
        erases: L('The whole SPI NOR flash is rewritten. Disks are not touched.', '整个 SPI NOR 闪存会被重写。不会改动磁盘。'),
        done: L('The board restarts into UEFI.', '开发板重启进入 UEFI。'),
      },
      {
        id: 'uboot', label: L('Mainline U-Boot', '主线 U-Boot'), file: 'rock4d-spi-uboot.img', lba: 0,
        note: L('U-Boot instead of UEFI, to go back or to boot systems that need it.', '用 U-Boot 代替 UEFI，用于回退或启动需要 U-Boot 的系统。'),
        erases: L('The whole SPI NOR flash is rewritten. Disks are not touched.', '整个 SPI NOR 闪存会被重写。不会改动磁盘。'),
        done: L('The board restarts into U-Boot.', '开发板重启进入 U-Boot。'),
      },
    ],
  },
  {
    id: 'cm5io',
    name: 'ArmSoM CM5-IO',
    storage: EMMC,
    maskrom: BUTTON_STEPS,
    targets: [
      {
        id: 'uefi', label: UEFI_WHOLE, image: 'cm5io', file: 'cm5io-emmc-edk2.img', lba: 0,
        note: L('For an empty eMMC, or one you want to start again.', '用于空的 eMMC，或想从头开始的 eMMC。'),
        erases: L('The partition table and the first 32 MiB of the eMMC are replaced. A system installed on the eMMC is lost.',
          'eMMC 的分区表和前 32 MiB 会被替换。装在 eMMC 上的系统会丢失。'),
        done: L('The board restarts into UEFI from the eMMC.', '开发板从 eMMC 重启进入 UEFI。'),
      },
      {
        id: 'uefi-keep', label: UEFI_KEEP, image: 'cm5io', file: 'cm5io-emmc-edk2.img',
        slice: [64 * SECTOR, NVDATA_LBA * SECTOR], lba: 64, keepsSettings: KEEP_SETTINGS,
        note: KEEP_NOTE,
        erases: L('The firmware, from sector 64, is rewritten. The partition table, the other partitions and the saved UEFI settings stay. Use this only on an eMMC that was set up with the whole image before.',
          '从扇区 64 开始的固件会被重写。分区表、其他分区和已保存的 UEFI 设置保持不变。仅用于之前用完整镜像装过的 eMMC。'),
        done: L('The board restarts into the new firmware.', '开发板重启进入新固件。'),
      },
      {
        id: 'uboot', label: L('Mainline U-Boot', '主线 U-Boot'), file: 'cm5io-sdcard-uboot.img', lba: 0,
        note: L('U-Boot instead of UEFI.', '用 U-Boot 代替 UEFI。'),
        erases: L('The partition table and the first 16 MiB of the eMMC are replaced.', 'eMMC 的分区表和前 16 MiB 会被替换。'),
        done: L('The board restarts into U-Boot from the eMMC.', '开发板从 eMMC 重启进入 U-Boot。'),
      },
    ],
  },
  {
    id: 'tspi3m',
    name: 'LCKFB TaishanPi 3M',
    storage: EMMC,
    maskrom: [
      L('This board has no MaskROM button. Power it off and connect the USB-C port marked OTG+DP to this computer.',
        '这块开发板没有 MaskROM 按键。断电后把标有 OTG+DP 的 USB-C 口连接到这台电脑。'),
      L('Short the two pads marked MSK, under the RK3576 silkscreen, and power the board on.',
        '短接 RK3576 丝印下方标有 MSK 的两个焊盘，然后给开发板上电。'),
    ],
    maskromNote: L('A board that already runs this firmware gets there without the pads: press F4 during the boot countdown.',
      '已经运行此固件的开发板不需要短接焊盘：在启动倒计时期间按 F4 即可。'),
    maskromLink: {
      text: L('Photo of the MSK pads', 'MSK 焊盘照片'),
      href: 'tspi3m-msk-pads.png',
    },
    targets: [
      {
        id: 'uefi', label: UEFI_WHOLE, image: 'tspi3m', file: 'tspi3m-emmc-edk2.img', lba: 0,
        note: L('For the first installation. This is the layout Windows is installed on.', '用于首次安装。Windows 就安装在这种布局上。'),
        erases: L('The partition table and the first 32 MiB of the eMMC are replaced. A system installed on the eMMC is lost, including the stock one.',
          'eMMC 的分区表和前 32 MiB 会被替换。装在 eMMC 上的系统会丢失，包括出厂系统。'),
        done: L('Power the board off and on. It starts UEFI from the eMMC.', '给开发板断电再上电。它会从 eMMC 启动 UEFI。'),
      },
      {
        id: 'uefi-keep', label: UEFI_KEEP, image: 'tspi3m', file: 'tspi3m-emmc-edk2.img',
        slice: [64 * SECTOR, NVDATA_LBA * SECTOR], lba: 64, keepsSettings: KEEP_SETTINGS,
        note: KEEP_NOTE,
        erases: L('The firmware, from sector 64, is rewritten. The partition table, the installed system and the saved UEFI settings stay. Use this only on an eMMC that was set up with the whole image before.',
          '从扇区 64 开始的固件会被重写。分区表、已安装的系统和已保存的 UEFI 设置保持不变。仅用于之前用完整镜像装过的 eMMC。'),
        done: L('Power the board off and on. It starts the new firmware.', '给开发板断电再上电。它会启动新固件。'),
      },
    ],
  },
];

// A file from the user's computer: written whole, from sector 0.
export function customTarget(file) {
  return {
    id: 'custom', label: L('A file from this computer', '这台电脑上的文件'), blob: file, fileName: file.name, lba: 0,
    erases: L('The file is written from sector 0, over whatever is there. An image made for another board or another storage leaves this one unable to start until it is written again from MaskROM.',
      '文件从扇区 0 开始写入，覆盖原有内容。为其他开发板或其他存储制作的镜像会让这块开发板无法启动，直到再次通过 MaskROM 写入。'),
    done: L('The file is written and the board restarts.', '文件已写入，开发板重启。'),
  };
}

// The UEFI image a channel of firmware.json has for a board:
// { version, file, size, sha256 }, or null.
export function channelImage(versions, channel, boardId) {
  return versions?.channels?.[channel]?.images?.[boardId] || null;
}

// A UEFI target with the file of one channel's image put in: the file to
// fetch, its version and the SHA-256 the download must have. The slice, the
// sector and the settings check stay those of the target, so a write that
// keeps the settings stops at the settings slot in every channel.
export function withImage(target, image, channel) {
  if (!target.image) return target;
  if (!image) return null;
  return { ...target, file: image.file, version: image.version, sha256: image.sha256, size: image.size, channel };
}

export function boardById(id) {
  return BOARDS.find((b) => b.id === id);
}
