// The page: a three-step PatternFly wizard around runFlash() in flash.js.
import { createFlashWorker } from './proxy.js?v=WASM_HASH';
import { BOARDS, boardById, customTarget } from './boards.js?v=WASM_HASH';
import { runFlash } from './flash.js?v=WASM_HASH';

const WORKER_URL = new URL('./worker.js?v=WASM_HASH', import.meta.url).href;
const MODULE_URL = new URL('../dist/rkdeveloptool.js?v=WASM_HASH', import.meta.url).href;
const WASM_URL = new URL('../dist/rkdeveloptool.wasm?v=WASM_HASH', import.meta.url).href;

const $ = (id) => document.getElementById(id);
const STEP_NAMES = ['Board', 'Firmware', 'Write'];

const ICONS = {
  info: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm1.5 22a1.5 1.5 0 1 1-3 0v-5.157l-.188.04a1.5 1.5 0 0 1-.625-2.934l1.956-.416c.112-.024.223-.032.333-.03l.024-.002a1.5 1.5 0 0 1 1.5 1.5v7Zm-.08-12.58c-.38.37-.89.58-1.42.58a1.998 1.998 0 0 1-1.851-2.76c.051-.13.11-.24.19-.35.07-.11.15-.21.25-.3.74-.75 2.08-.75 2.83 0 .09.09.17.19.24.3.08.11.14.22.189.35.05.12.09.24.11.37.03.13.04.26.04.39 0 .53-.21 1.04-.58 1.42Z',
  success: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm7.795 11.795-8.646 8.646c-.317.317-.733.475-1.149.475s-.832-.158-1.149-.475l-4.646-4.646a1.126 1.126 0 0 1 1.591-1.591l4.205 4.205 8.205-8.205a1.126 1.126 0 0 1 1.591 1.591Z',
  warning: 'm31.874 28.514-15.011-27a1.001 1.001 0 0 0-1.748 0l-15.011 27A1 1 0 0 0 .978 30H31a1 1 0 0 0 .874-1.486ZM14.5 12a1.5 1.5 0 0 1 3 0v5a1.5 1.5 0 0 1-3 0v-5ZM16 26.001a2 2 0 1 1-.001-3.999A2 2 0 0 1 16 26.001Z',
  danger: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm-1.5 8a1.5 1.5 0 1 1 3 0v7a1.5 1.5 0 1 1-3 0V9ZM16 25.001a2 2 0 1 1-.001-3.999A2 2 0 0 1 16 25.001Z',
};
const KIND_WORD = { info: 'Info', success: 'Success', warning: 'Warning', danger: 'Danger' };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
}

// An inline PatternFly alert. `body` and `action` are trusted markup built here.
function alertHtml(kind, title, body = '', action = '') {
  return `<div class="pf-v6-c-alert pf-m-inline pf-m-${kind}" aria-label="${KIND_WORD[kind]} alert">
    <div class="pf-v6-c-alert__icon"><svg class="pf-v6-svg" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true" role="img" width="1em" height="1em"><path d="${ICONS[kind]}"/></svg></div>
    <p class="pf-v6-c-alert__title"><span class="pf-v6-screen-reader">${KIND_WORD[kind]} alert:</span> ${esc(title)}</p>
    ${body ? `<div class="pf-v6-c-alert__description">${body}</div>` : ''}
    ${action ? `<div class="pf-v6-c-alert__action-group">${action}</div>` : ''}
  </div>`;
}

const state = {
  step: 0,
  reached: 0,
  board: null,        // an entry of BOARDS
  targetId: null,     // a target id of that board, or 'custom'
  file: null,         // File, for 'custom'
  versions: null,     // { release, images: { rock4d, cm5io, tspi3m } } from firmware.json
  rk: null,           // worker proxy once the tool has loaded
  toolError: null,
  running: false,
  finished: false,
};

function currentTarget() {
  if (!state.board || !state.targetId) return null;
  if (state.targetId === 'custom') return state.file ? customTarget(state.file) : null;
  return state.board.targets.find((t) => t.id === state.targetId) || null;
}

function versionOf(board) {
  return state.versions?.images?.[board.id] || null;
}

// ── Notices above the wizard ───────────────────────────────────────────────
const notices = new Map();
function setNotice(key, html) {
  if (html) notices.set(key, html); else notices.delete(key);
  $('notices-body').innerHTML = `<div class="pf-v6-l-stack pf-m-gutter">${[...notices.values()].map((h) => `<div class="pf-v6-l-stack__item">${h}</div>`).join('')}</div>`;
  $('notices').hidden = notices.size === 0;
}

// ── Step 1: board ──────────────────────────────────────────────────────────
function renderBoards() {
  $('board-rows').innerHTML = BOARDS.map((b) => {
    const v = versionOf(b);
    const checked = state.board === b;
    return `<tr class="pf-v6-c-table__tr pf-m-clickable${checked ? ' pf-m-selected' : ''}" role="row" data-board="${b.id}">
      <td class="pf-v6-c-table__td pf-v6-c-table__check"><div class="pf-v6-c-radio pf-m-standalone"><input class="pf-v6-c-radio__input" type="radio" name="board" id="board-${b.id}" value="${b.id}" aria-label="${esc(b.name)}"${checked ? ' checked' : ''}></div></td>
      <td class="pf-v6-c-table__td nowrap-md" data-label="Board">${esc(b.name)}</td>
      <td class="pf-v6-c-table__td nowrap-md" data-label="Written to">${esc(b.storage)}</td>
      <td class="pf-v6-c-table__td" data-label="UEFI firmware">${v ? esc(v) : 'edk2-rk3576'}</td>
    </tr>`;
  }).join('');
  const rel = state.versions?.release;
  $('release-note').innerHTML = rel
    ? `The UEFI images come from edk2-rk3576 release <a href="https://github.com/gahingwoo/edk2-rk3576/releases/tag/${encodeURIComponent(rel)}">${esc(rel)}</a>. A board whose image did not change in that release keeps its older version.`
    : 'The UEFI images come from the latest <a href="https://github.com/gahingwoo/edk2-rk3576/releases/latest">edk2-rk3576 release</a>.';
}

function chooseBoard(id) {
  if (state.running) return;
  const b = boardById(id);
  if (!b || b === state.board) return;
  state.board = b;
  state.targetId = b.targets[0].id;
  state.reached = Math.min(state.reached, 0);
  state.finished = false;
  renderBoards();
  render();
}

$('board-rows').addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-board]');
  if (row) chooseBoard(row.dataset.board);
});
$('board-rows').addEventListener('change', (e) => {
  if (e.target.name === 'board') chooseBoard(e.target.value);
});

// ── Step 2: firmware ───────────────────────────────────────────────────────
function renderTargets() {
  const b = state.board;
  if (!b) return;
  $('firmware-lead').textContent = `What to write to the ${b.storage} of the ${b.name}.`;
  const v = versionOf(b);
  const rows = b.targets.map((t) => ({
    id: t.id,
    label: t.image && v ? `${t.label} ${v}` : t.label,
    note: t.note,
  }));
  rows.push({ id: 'custom', label: 'A file from this computer', note: 'Any .img or .bin, written from sector 0.' });
  $('target-radios').innerHTML = rows.map((r) => `<div class="pf-v6-c-radio">
      <input class="pf-v6-c-radio__input" type="radio" name="target" id="target-${r.id}" value="${r.id}"${state.targetId === r.id ? ' checked' : ''}>
      <label class="pf-v6-c-radio__label" for="target-${r.id}">${esc(r.label)}</label>
      <span class="pf-v6-c-radio__description">${esc(r.note)}</span>
    </div>`).join('');
  $('file-row').hidden = state.targetId !== 'custom';
  $('file-name').textContent = state.file ? `${state.file.name}, ${(state.file.size / 1048576).toFixed(1)} MiB` : 'No file chosen';
}

$('target-radios').addEventListener('change', (e) => {
  if (e.target.name !== 'target' || state.running) return;
  state.targetId = e.target.value;
  state.reached = Math.min(state.reached, 1);
  state.finished = false;
  $('ack').checked = false;
  render();
});
$('file-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', () => {
  state.file = $('file-input').files[0] || null;
  state.reached = Math.min(state.reached, 1);
  $('ack').checked = false;
  render();
});

// ── Step 3: review and write ───────────────────────────────────────────────
function dl(term, desc) {
  return `<div class="pf-v6-c-description-list__group">
    <dt class="pf-v6-c-description-list__term"><span class="pf-v6-c-description-list__text">${esc(term)}</span></dt>
    <dd class="pf-v6-c-description-list__description"><div class="pf-v6-c-description-list__text">${desc}</div></dd>
  </div>`;
}

function renderReview() {
  const b = state.board;
  const t = currentTarget();
  if (!b || !t) return;
  const v = versionOf(b);
  const what = t.image && v ? `${t.label} ${v}` : t.label;
  const size = t.blob ? `${(t.blob.size / 1048576).toFixed(1)} MiB`
    : t.slice ? `${((t.slice[1] - t.slice[0]) / 1048576).toFixed(1)} MiB of the image` : 'the whole image';
  $('review').innerHTML = dl('Board', esc(b.name))
    + dl('Firmware', esc(what))
    + dl('File', `<span class="detail">${esc(t.fileName || t.file)}</span>`)
    + dl('Written to', `${esc(b.storage)}, from sector ${t.lba}, ${esc(size)}`);
  $('erase-alert').innerHTML = alertHtml('warning', 'What this replaces', `<p>${esc(t.erases)}</p>`);
  $('maskrom-steps').innerHTML = b.maskrom.map((s) => `<li>${esc(s)}</li>`).join('');
  const link = (b.maskromNote ? esc(b.maskromNote) + ' ' : '')
    + (b.maskromLink ? `<a href="${esc(b.maskromLink.href)}">${esc(b.maskromLink.text)}</a>. ` : '');
  $('maskrom-more').innerHTML = `${link}Linux and macOS need no driver. On Windows the device needs the WinUSB driver, installed with <a href="https://zadig.akeo.ie/">Zadig</a>. More in the <a href="https://edk2.gahingwoo.com/FLASHING.html">flashing instructions</a>.`;
  $('ack-block').hidden = state.targetId !== 'custom';
}

function setProgress(percent, title) {
  if (title != null) $('progress-title').textContent = title;
  if (percent != null) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    $('progress-measure').textContent = `${p}%`;
    $('progress-bar').setAttribute('aria-valuenow', String(p));
    $('progress-indicator').style.width = `${p}%`;
  }
}

function log(text, kind = '') {
  const span = document.createElement('span');
  if (kind) span.className = `log-${kind}`;
  span.textContent = text + '\n';
  const el = $('log');
  el.appendChild(span);
  el.scrollTop = el.scrollHeight;
}

function setLogOpen(open) {
  $('log-section').classList.toggle('pf-m-expanded', open);
  $('log-toggle').setAttribute('aria-expanded', String(open));
  $('log-content').hidden = !open;
}
$('log-toggle').addEventListener('click', () => setLogOpen($('log-content').hidden));

const ANSI = /\x1b\[[\d;]*[A-Za-z]/g;
function onStdout(text) {
  text = text.replace(ANSI, '');
  if (!text.trim()) return;
  log(text);
  const m = text.match(/\((\d+)%\)/);
  if (m) setProgress(+m[1]);
}

// The second device prompt needs its own click: show a button and wait for it.
function reconnect(request) {
  return new Promise((resolve) => {
    const show = (failed) => {
      $('run-alert').innerHTML = alertHtml('info', 'Choose the board again',
        `<p>The loader is running and the board has come back as a new USB device. Reconnect the cable if the board does not show up.</p>${failed ? `<p>${esc(failed)}</p>` : ''}`,
        '<button class="pf-v6-c-button pf-m-primary" type="button" id="reconnect"><span class="pf-v6-c-button__text">Choose the board</span></button>');
      $('reconnect').addEventListener('click', async () => {
        try {
          await request();
          $('run-alert').innerHTML = '';
          resolve();
        } catch (e) {
          show('No device was chosen. Try again.');
        }
      });
      $('reconnect').focus();
    };
    show('');
  });
}

async function start() {
  const board = state.board;
  const target = currentTarget();
  if (!state.rk || state.running || !board || !target) return;
  state.running = true;
  state.finished = false;
  $('run-block').hidden = false;
  $('run-alert').innerHTML = '';
  $('log').textContent = '';
  setProgress(0, 'Starting');
  render();
  try {
    await runFlash({
      rk: state.rk,
      usb: navigator.usb,
      fetchBlob: async (url) => {
        const name = url.replace('./', '');
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return await r.blob();
        } catch (e) {
          throw new Error(`Could not download ${name} (${e.message}). Nothing was written.`);
        }
      },
      board, target,
      ui: { status: (t) => setProgress(null, t), log, progress: (p) => setProgress(p), reconnect },
    });
    setProgress(100, 'Written');
    $('run-alert').innerHTML = alertHtml('success', 'Written', `<p>${esc(target.done)}</p>`);
    log('\n' + target.done);
    state.finished = true;
  } catch (err) {
    const cancelled = err && err.name === 'NotFoundError';
    const message = cancelled ? 'No device was chosen. Nothing was written.' : (err.message || String(err));
    setProgress(null, 'Stopped');
    $('run-alert').innerHTML = alertHtml(cancelled ? 'info' : 'danger', cancelled ? 'No device chosen' : 'The write did not finish', `<p>${esc(message)}</p>`);
    log('\n' + message, 'err');
    if (!cancelled) setLogOpen(true);
  } finally {
    state.running = false;
    render();
  }
}

// ── Wizard frame ───────────────────────────────────────────────────────────
function canLeave(step) {
  if (step === 0) return !!state.board;
  if (step === 1) return !!currentTarget();
  return false;
}

function goTo(step) {
  if (state.running || step < 0 || step > 2) return;
  for (let s = 0; s < step; s++) if (!canLeave(s)) return;
  state.step = step;
  state.reached = Math.max(state.reached, step);
  if (step !== 2) { $('run-block').hidden = true; state.finished = false; }
  setNavOpen(false);
  render();
  $('wizard-main').scrollTop = 0;
  $('wizard-main').focus({ preventScroll: true });
}

function setNavOpen(open) {
  $('wizard-toggle').classList.toggle('pf-m-expanded', open);
  $('wizard-toggle').setAttribute('aria-expanded', String(open));
  $('wizard-nav').classList.toggle('pf-m-expanded', open);
}
$('wizard-toggle').addEventListener('click', () => setNavOpen(!$('wizard-nav').classList.contains('pf-m-expanded')));

document.querySelectorAll('.pf-v6-c-wizard__nav-link').forEach((link) => {
  link.addEventListener('click', () => goTo(+link.dataset.step));
});
$('back').addEventListener('click', () => goTo(state.step - 1));
$('next').addEventListener('click', () => { if (state.step === 2) start(); else goTo(state.step + 1); });
$('ack').addEventListener('change', render);

function render() {
  document.querySelectorAll('.step').forEach((el) => { el.hidden = +el.dataset.step !== state.step; });
  document.querySelectorAll('.pf-v6-c-wizard__nav-link').forEach((link) => {
    const s = +link.dataset.step;
    const current = s === state.step;
    const open = !state.running && s <= state.reached;
    link.classList.toggle('pf-m-current', current);
    link.classList.toggle('pf-m-disabled', !open && !current);
    link.disabled = !open && !current;
    if (current) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
  });
  $('toggle-num').textContent = String(state.step + 1);
  $('toggle-name').textContent = STEP_NAMES[state.step];

  if (state.step === 1) renderTargets();
  if (state.step === 2) renderReview();

  const next = $('next');
  const label = next.querySelector('.pf-v6-c-button__text');
  let note = '';
  if (state.step < 2) {
    label.textContent = 'Next';
    next.disabled = !canLeave(state.step);
    if (state.step === 1 && state.targetId === 'custom' && !state.file) note = 'Choose a file first.';
  } else {
    label.textContent = state.running ? 'Writing' : state.finished ? 'Write again' : 'Connect and write';
    const needAck = state.targetId === 'custom' && !$('ack').checked;
    next.disabled = state.running || !state.rk || !navigator.usb || needAck;
    if (!navigator.usb) note = 'This browser cannot reach USB devices.';
    else if (state.toolError) note = 'The write tool did not load.';
    else if (!state.rk) note = 'Loading the write tool.';
    else if (needAck) note = 'Tick the box above first.';
    else if (state.running) note = 'Keep this page open and the cable connected.';
  }
  $('back').disabled = state.step === 0 || state.running;
  $('footer-note').textContent = note;
}

// ── Start ──────────────────────────────────────────────────────────────────
renderBoards();
render();

fetch('./firmware.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((v) => {
  if (!v) return;
  state.versions = v;
  renderBoards();
  render();
});

if (!navigator.usb) {
  setNotice('usb', alertHtml('warning', 'This browser cannot reach USB devices',
    '<p>Writing needs WebUSB, which Chrome and Edge have on a computer. You can still look through the steps here.</p>'));
} else if (!self.crossOriginIsolated) {
  // The service worker in index.html reloads the page once it is installed.
  // If the page is still not isolated after that, say so.
  setTimeout(() => {
    if (!self.crossOriginIsolated && !state.rk) {
      state.toolError = 'not isolated';
      setNotice('tool', alertHtml('danger', 'The write tool could not start',
        '<p>This page could not turn on cross-origin isolation, which the USB code needs. Reload the page; a private window or blocked service workers prevent it.</p>'));
      render();
    }
  }, 4000);
} else {
  createFlashWorker({
    workerUrl: WORKER_URL, moduleUrl: MODULE_URL, wasmUrl: WASM_URL,
    onStdout,
    onStderr: (text) => { text = text.replace(ANSI, ''); if (text.trim()) log(text, 'warn'); },
  }).then((rk) => {
    state.rk = rk;
    render();
  }).catch((err) => {
    state.toolError = err.message || String(err);
    setNotice('tool', alertHtml('danger', 'The write tool did not load', `<p>${esc(state.toolError)}</p><p>Reload the page to try again.</p>`));
    render();
  });
}
