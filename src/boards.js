// What this page can write on each board.
//
// Every write is "rkdeveloptool wl <lba> <file>" through the loader in
// rk3576_spl_loader.bin, which selects the SPI NOR on the ROCK 4D and the
// eMMC on the other two boards.
//
// A target with `slice` writes only part of the image file: `slice` is
// [first byte, end byte) of the file and `lba` is where that part belongs on
// the storage. The numbers come from edk2-rk3576's docs/FLASHING.md.

const SECTOR = 512;
const MIB = 1024 * 1024;

// The eMMC layout edk2-rk3576 builds for the CM5-IO and the TaishanPi 3M:
// the SPL from sector 64, the FIT image from sector 16384, and inside the
// FIT, last, the 192 KiB "nvdata" slot that holds the saved UEFI settings.
// The image carries that slot empty (all 0xFF); the board fills it on its
// first boot. A write that keeps the settings stops where the slot starts.
// flash.js checks this against the FIT in the downloaded image.
const FIT_LBA = 16384;
const NVDATA_LBA = 43648;
const KEEP_SETTINGS = { fitLba: FIT_LBA, nvdataLba: NVDATA_LBA };

const BUTTON_STEPS = [
  'Unplug the board from power.',
  'Hold the MaskROM button and plug the USB-C cable into this computer.',
  'Release the button.',
];

// The ROCK 4D's USB-C port only supplies power (its data pins are not
// connected); the download port is the USB-A port wired to the SoC's OTG
// controller, with a USB-A to USB-A cable.
const ROCK4D_STEPS = [
  'Unplug the board from power.',
  'Connect a USB-A to USB-A cable from the board\'s upper USB 3.0 USB-A port to this computer. The USB-C port only supplies power.',
  'Hold the MaskROM button and plug in the power supply on USB-C.',
  'Release the button.',
];

export const BOARDS = [
  {
    id: 'rock4d',
    name: 'Radxa ROCK 4D',
    storage: 'SPI NOR flash',
    storageBytes: 16 * MIB,
    maskrom: ROCK4D_STEPS,
    targets: [
      {
        id: 'uefi', label: 'UEFI firmware', image: 'rock4d', file: 'rock4d-spi-edk2.img', lba: 0,
        note: 'The edk2-rk3576 image for the SPI NOR flash.',
        erases: 'The whole SPI NOR flash is rewritten. Disks are not touched.',
        done: 'The board restarts into UEFI.',
      },
      {
        id: 'uboot', label: 'Mainline U-Boot', file: 'rock4d-spi-uboot.img', lba: 0,
        note: 'U-Boot instead of UEFI, to go back or to boot systems that need it.',
        erases: 'The whole SPI NOR flash is rewritten. Disks are not touched.',
        done: 'The board restarts into U-Boot.',
      },
    ],
  },
  {
    id: 'cm5io',
    name: 'ArmSoM CM5-IO',
    storage: 'eMMC',
    maskrom: BUTTON_STEPS,
    targets: [
      {
        id: 'uefi', label: 'UEFI firmware, whole image', image: 'cm5io', file: 'cm5io-emmc-edk2.img', lba: 0,
        note: 'For an empty eMMC, or one you want to start again.',
        erases: 'The partition table and the first 32 MiB of the eMMC are replaced. A system installed on the eMMC is lost.',
        done: 'The board restarts into UEFI from the eMMC.',
      },
      {
        id: 'uefi-keep', label: 'UEFI firmware, keep the partitions', image: 'cm5io', file: 'cm5io-emmc-edk2.img',
        slice: [64 * SECTOR, NVDATA_LBA * SECTOR], lba: 64, keepsSettings: KEEP_SETTINGS,
        note: 'For an eMMC that already has this firmware and a system on it. Only the firmware is written.',
        erases: 'The firmware, from sector 64, is rewritten. The partition table, the other partitions and the saved UEFI settings stay. Use this only on an eMMC that was set up with the whole image before.',
        done: 'The board restarts into the new firmware.',
      },
      {
        id: 'uboot', label: 'Mainline U-Boot', file: 'cm5io-sdcard-uboot.img', lba: 0,
        note: 'U-Boot instead of UEFI.',
        erases: 'The partition table and the first 16 MiB of the eMMC are replaced.',
        done: 'The board restarts into U-Boot from the eMMC.',
      },
    ],
  },
  {
    id: 'tspi3m',
    name: 'LCKFB TaishanPi 3M',
    storage: 'eMMC',
    maskrom: [
      'This board has no MaskROM button. Power it off and connect the USB-C port marked OTG+DP to this computer.',
      'Short the two pads marked MSK, under the RK3576 silkscreen, and power the board on.',
    ],
    maskromNote: 'A board that already runs this firmware gets there without the pads: press F4 during the boot countdown.',
    maskromLink: {
      text: 'Photo of the MSK pads',
      href: 'tspi3m-msk-pads.png',
    },
    targets: [
      {
        id: 'uefi', label: 'UEFI firmware, whole image', image: 'tspi3m', file: 'tspi3m-emmc-edk2.img', lba: 0,
        note: 'For the first installation. This is the layout Windows is installed on.',
        erases: 'The partition table and the first 32 MiB of the eMMC are replaced. A system installed on the eMMC is lost, including the stock one.',
        done: 'Power the board off and on. It starts UEFI from the eMMC.',
      },
      {
        id: 'uefi-keep', label: 'UEFI firmware, keep the partitions', image: 'tspi3m', file: 'tspi3m-emmc-edk2.img',
        slice: [64 * SECTOR, NVDATA_LBA * SECTOR], lba: 64, keepsSettings: KEEP_SETTINGS,
        note: 'For an eMMC that already has this firmware and a system on it. Only the firmware is written.',
        erases: 'The firmware, from sector 64, is rewritten. The partition table, the installed system and the saved UEFI settings stay. Use this only on an eMMC that was set up with the whole image before.',
        done: 'Power the board off and on. It starts the new firmware.',
      },
    ],
  },
];

// A file from the user's computer: written whole, from sector 0.
export function customTarget(file) {
  return {
    id: 'custom', label: 'A file from this computer', blob: file, fileName: file.name, lba: 0,
    erases: 'The file is written from sector 0, over whatever is there. An image made for another board or another storage leaves this one unable to start until it is written again from MaskROM.',
    done: 'The file is written and the board restarts.',
  };
}

export function boardById(id) {
  return BOARDS.find((b) => b.id === id);
}
