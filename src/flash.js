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
// the user otherwise. Nothing is written before the checks in prepare().

const SECTOR = 512;
const VENDOR_ROCKCHIP = 0x2207;
export const LOADER = './rk3576_spl_loader.bin';

// The part of the image that goes on the storage, and the checks that can be
// made before a device is involved.
export function prepare(board, target, blob) {
  let part = blob;
  if (target.slice) {
    const [start, end] = target.slice;
    if (start % SECTOR || end % SECTOR) throw new Error('The image part does not start and end on a sector.');
    if (blob.size < end) {
      throw new Error(`The image is ${blob.size} bytes, shorter than the ${end} bytes this write expects. Nothing was written.`);
    }
    part = blob.slice(start, end);
  }
  if (part.size === 0) throw new Error('The image is empty. Nothing was written.');
  if (board.storageBytes && target.lba * SECTOR + part.size > board.storageBytes) {
    throw new Error(`The image does not fit the ${board.storage} (${board.storageBytes / 1048576} MiB). Nothing was written.`);
  }
  return part;
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
      fwFetch = fetchBlob('./' + target.file);
    }
    // A failed download is reported at the await below, not as an unhandled rejection.
    loaderFetch.catch(() => {});
    fwFetch.catch(() => {});

    // requestDevice() has to run inside the click that started this, so
    // nothing is awaited before it.
    ui.status('Choose the Rockchip device in the browser prompt');
    const device = await usb.requestDevice({ filters: [{ vendorId: VENDOR_ROCKCHIP }] });
    const maskrom = !device.serialNumber;
    ui.log(`USB device: ${device.productName || 'Rockchip'} (PID 0x${device.productId.toString(16)}), ${maskrom ? 'MaskROM' : 'loader'} mode`);

    ui.status('Waiting for the downloads');
    const [loaderBlob, fwBlob] = await Promise.all([loaderFetch, fwFetch]);
    const part = prepare(board, target, fwBlob);
    ui.log(`Loader: ${(loaderBlob.size / 1024).toFixed(0)} KiB`);
    ui.log(`Image: ${(fwBlob.size / 1048576).toFixed(1)} MiB` + (target.slice ? `, writing ${(part.size / 1048576).toFixed(1)} MiB of it` : ''));

    loaderMount = await rk.mountBlob('loader.bin', loaderBlob);
    fwMount = await rk.mountBlob('firmware.img', part);

    if (maskrom) {
      ui.status('Sending the loader');
      ui.log('\n$ rkdeveloptool db loader.bin');
      const db = await rk.run(['db', loaderMount.path]);
      if (db.exitCode !== 0) throw new Error(`Sending the loader failed (rkdeveloptool db, exit ${db.exitCode}). Nothing was written.`);

      // The board re-enumerates under the loader. WebUSB drops the old handle,
      // and a new requestDevice() needs a new click.
      ui.log('Loader sent. The board comes back as a new USB device.', 'dim');
      ui.status('Choose the board again');
      await ui.reconnect(() => usb.requestDevice({ filters: [{ vendorId: VENDOR_ROCKCHIP }] }));
      ui.log('Device chosen.', 'dim');
    } else {
      ui.log('The device is already in loader mode.', 'dim');
    }

    ui.status(`Writing to the ${board.storage}`);
    ui.log(`\n$ rkdeveloptool wl ${target.lba} firmware.img`);
    const wl = await rk.run(['wl', String(target.lba), fwMount.path]);
    if (wl.exitCode !== 0) throw new Error(`The write failed (rkdeveloptool wl, exit ${wl.exitCode}). The ${board.storage} may be partly written: write it again.`);

    ui.log('\n$ rkdeveloptool rd');
    await rk.run(['rd']);
    ui.progress(100);
  } finally {
    if (loaderMount) await rk.umount(loaderMount).catch(() => {});
    if (fwMount) await rk.umount(fwMount).catch(() => {});
  }
}
