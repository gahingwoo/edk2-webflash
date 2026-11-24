// The write sequence, apart from the page: everything it touches is passed in,
// so tests/flash.test.html can run it against fakes.
//
//   rk          the worker proxy from proxy.js: mountBlob, umount, run
//   usb         navigator.usb
//   fetchBlob   (url) => Promise<Blob>
//   board       an entry of BOARDS
//   target      one of its targets, or customTarget(file)
//   ui          { status(text), log(text, kind), progress(percent),
//                 reconnect() => Promise that settles once the user has
//                 picked the device again from a click }
//
// Resolves when the board has been told to reset; throws with a message for
// the user otherwise. Nothing is written before the checks in prepare(),
// checkDownload() and, for a write that keeps the settings, checkSettingsSlot().
import { t, tr } from './i18n.js?v=WASM_HASH';

const SECTOR = 512;
const VENDOR_ROCKCHIP = 0x2207;
export const LOADER = './rk3576_spl_loader.bin';

// The part of the image that goes on the storage, and the checks that can be
// made before a device is involved.
export function prepare(board, target, blob) {
  let part = blob;
  if (target.slice) {
    const [start, end] = target.slice;
    if (start % SECTOR || end % SECTOR) throw new Error(t('flash.sector'));
    if (blob.size < end) {
      throw new Error(t('flash.short', { size: blob.size, end }));
    }
    part = blob.slice(start, end);
  }
  if (part.size === 0) throw new Error(t('flash.empty'));
  if (board.storageBytes && target.lba * SECTOR + part.size > board.storageBytes) {
    throw new Error(t('flash.fit', { storage: tr(board.storage), mib: board.storageBytes / 1048576 }));
  }
  return part;
}

// For a write that keeps the saved UEFI settings: find the "nvdata" image in
// the FIT at fitLba and check that it starts exactly where the write stops.
// A build with a different layout would otherwise either cut the firmware
// short or write its empty settings slot over the board's saved settings.
export async function checkSettingsSlot(blob, target, layout) {
  const fit = layout.fitLba * SECTOR;
  const head = new DataView(await blob.slice(fit, fit + 64 * 1024).arrayBuffer());
  const refuse = (why) => new Error(t('flash.nothing', { why }));
  if (head.byteLength < 40 || head.getUint32(0) !== 0xd00dfeed) throw refuse(t('flash.noFit', { lba: layout.fitLba }));
  const total = head.getUint32(4), offStruct = head.getUint32(8), offStrings = head.getUint32(12);
  if (total > head.byteLength) throw refuse(t('flash.fitLarge'));
  const bytes = new Uint8Array(head.buffer, head.byteOffset, total);
  const str = (o) => { let e = o; while (e < bytes.length && bytes[e]) e++; return new TextDecoder().decode(bytes.subarray(o, e)); };
  const path = [];
  let nvOffset = null;
  for (let p = offStruct; p + 4 <= total;) {
    const tok = head.getUint32(p); p += 4;
    if (tok === 1) { const name = str(p); path.push(name); p = (p + name.length + 1 + 3) & ~3; }
    else if (tok === 2) path.pop();
    else if (tok === 3) {
      const len = head.getUint32(p), name = str(offStrings + head.getUint32(p + 4)); p += 8;
      if (path.join('/') === '/images/nvdata' && name === 'data-offset' && len === 4) nvOffset = head.getUint32(p);
      p = (p + len + 3) & ~3;
    } else if (tok === 4) continue;
    else break;
  }
  if (nvOffset === null) throw refuse(t('flash.noNvdata'));
  const nvdata = fit + ((total + 3) & ~3) + nvOffset;
  if (nvdata !== layout.nvdataLba * SECTOR || target.slice[1] !== nvdata) {
    throw refuse(t('flash.nvMoved', { at: nvdata, want: layout.nvdataLba * SECTOR }));
  }
}

// The downloaded image is the one firmware.json describes: its size and
// SHA-256. A page and an image from two different deploys, or a damaged
// download, are refused before the board is touched.
export async function checkDownload(blob, target) {
  const name = target.file.split('/').pop();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (target.size != null && blob.size !== target.size) {
    throw new Error(t('flash.size', { name, size: blob.size, want: target.size }));
  }
  const got = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  if (got !== target.sha256) {
    throw new Error(t('flash.checksum', { name, got: got.slice(0, 16), want: target.sha256.slice(0, 16) }));
  }
}

export async function runFlash({ rk, usb, fetchBlob, board, target, ui }) {
  let loaderMount = null;
  let fwMount = null;
  try {
    // Downloads start now and run while the user picks the device. A custom
    // file is a File handle already; it is read as it is written.
    ui.log(`Fetching ${LOADER.slice(2)}`, 'dim');
    const loaderFetch = fetchBlob(LOADER);
    let fwFetch;
    if (target.blob) {
      fwFetch = Promise.resolve(target.blob);
    } else {
      ui.log(`Fetching ${target.file}`, 'dim');
      // The checksum in the query: a new image under the same name is never
      // taken from the browser's cache.
      fwFetch = fetchBlob('./' + target.file + (target.sha256 ? `?v=${target.sha256.slice(0, 16)}` : ''));
    }
    // A failed download is reported at the await below, not as an unhandled rejection.
    loaderFetch.catch(() => {});
    fwFetch.catch(() => {});

    // requestDevice() has to run inside the click that started this, so
    // nothing is awaited before it.
    ui.status(t('status.choose'));
    const device = await usb.requestDevice({ filters: [{ vendorId: VENDOR_ROCKCHIP }] });
    const maskrom = !device.serialNumber;
    ui.log(`USB device: ${device.productName || 'Rockchip'} (PID 0x${device.productId.toString(16)}), ${maskrom ? 'MaskROM' : 'loader'} mode`);

    ui.status(t('status.downloads'));
    const [loaderBlob, fwBlob] = await Promise.all([loaderFetch, fwFetch]);
    if (target.sha256) {
      ui.status(t('status.checking'));
      await checkDownload(fwBlob, target);
      ui.log(`SHA-256 ${target.sha256}: OK`, 'dim');
    }
    const part = prepare(board, target, fwBlob);
    if (target.keepsSettings) await checkSettingsSlot(fwBlob, target, target.keepsSettings);
    ui.log(`Loader: ${(loaderBlob.size / 1024).toFixed(0)} KiB`);
    ui.log(`Image: ${(fwBlob.size / 1048576).toFixed(1)} MiB` + (target.slice ? `, writing ${(part.size / 1048576).toFixed(1)} MiB of it` : ''));

    loaderMount = await rk.mountBlob('loader.bin', loaderBlob);
    fwMount = await rk.mountBlob('firmware.img', part);

    if (maskrom) {
      ui.status(t('status.loader'));
      ui.log('\n$ rkdeveloptool db loader.bin');
      const db = await rk.run(['db', loaderMount.path]);
      if (db.exitCode !== 0) throw new Error(t('flash.db', { code: db.exitCode }));

      // The board re-enumerates under the loader. WebUSB drops the old handle,
      // and a new requestDevice() needs a new click.
      ui.log('Loader sent. The board comes back as a new USB device.', 'dim');
      ui.status(t('status.again'));
      await ui.reconnect(() => usb.requestDevice({ filters: [{ vendorId: VENDOR_ROCKCHIP }] }));
      ui.log('Device chosen.', 'dim');
    } else {
      ui.log('The device is already in loader mode.', 'dim');
    }

    ui.status(t('status.writing', { storage: tr(board.storage) }));
    ui.log(`\n$ rkdeveloptool wl ${target.lba} firmware.img`);
    const wl = await rk.run(['wl', String(target.lba), fwMount.path]);
    if (wl.exitCode !== 0) throw new Error(t('flash.wl', { code: wl.exitCode, storage: tr(board.storage) }));

    ui.log('\n$ rkdeveloptool rd');
    await rk.run(['rd']);
    ui.progress(100);
  } finally {
    if (loaderMount) await rk.umount(loaderMount).catch(() => {});
    if (fwMount) await rk.umount(fwMount).catch(() => {});
  }
}
