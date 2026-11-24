// The page: a three-step PatternFly wizard around runFlash() in flash.js.
import { createFlashWorker } from './proxy.js?v=WASM_HASH';
import { BOARDS, boardById, customTarget, channelImage, withImage } from './boards.js?v=WASM_HASH';
import { runFlash } from './flash.js?v=WASM_HASH';
import { t, tr, getLang, setLang, locale, applyStatic } from './i18n.js?v=WASM_HASH';

const WORKER_URL = new URL('./worker.js?v=WASM_HASH', import.meta.url).href;
const MODULE_URL = new URL('../dist/rkdeveloptool.js?v=WASM_HASH', import.meta.url).href;
const WASM_URL = new URL('../dist/rkdeveloptool.wasm?v=WASM_HASH', import.meta.url).href;

const $ = (id) => document.getElementById(id);
const STEP_KEYS = ['step.board', 'step.firmware', 'step.write'];
const CHANNELS = ['stable', 'prerelease', 'ci'];
const REPO_URL = 'https://github.com/gahingwoo/edk2-rk3576';

const ICONS = {
  info: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm1.5 22a1.5 1.5 0 1 1-3 0v-5.157l-.188.04a1.5 1.5 0 0 1-.625-2.934l1.956-.416c.112-.024.223-.032.333-.03l.024-.002a1.5 1.5 0 0 1 1.5 1.5v7Zm-.08-12.58c-.38.37-.89.58-1.42.58a1.998 1.998 0 0 1-1.851-2.76c.051-.13.11-.24.19-.35.07-.11.15-.21.25-.3.74-.75 2.08-.75 2.83 0 .09.09.17.19.24.3.08.11.14.22.189.35.05.12.09.24.11.37.03.13.04.26.04.39 0 .53-.21 1.04-.58 1.42Z',
  success: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm7.795 11.795-8.646 8.646c-.317.317-.733.475-1.149.475s-.832-.158-1.149-.475l-4.646-4.646a1.126 1.126 0 0 1 1.591-1.591l4.205 4.205 8.205-8.205a1.126 1.126 0 0 1 1.591 1.591Z',
  warning: 'm31.874 28.514-15.011-27a1.001 1.001 0 0 0-1.748 0l-15.011 27A1 1 0 0 0 .978 30H31a1 1 0 0 0 .874-1.486ZM14.5 12a1.5 1.5 0 0 1 3 0v5a1.5 1.5 0 0 1-3 0v-5ZM16 26.001a2 2 0 1 1-.001-3.999A2 2 0 0 1 16 26.001Z',
  danger: 'M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm-1.5 8a1.5 1.5 0 1 1 3 0v7a1.5 1.5 0 1 1-3 0V9ZM16 25.001a2 2 0 1 1-.001-3.999A2 2 0 0 1 16 25.001Z',
};


function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
}

// An inline PatternFly alert. `body` and `action` are trusted markup built here.
function alertHtml(kind, title, body = '', action = '') {
  return `<div class="pf-v6-c-alert pf-m-inline pf-m-${kind}" aria-label="${esc(t(`alert.${kind}`))}">
    <div class="pf-v6-c-alert__icon"><svg class="pf-v6-svg" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true" role="img" width="1em" height="1em"><path d="${ICONS[kind]}"/></svg></div>
    <p class="pf-v6-c-alert__title"><span class="pf-v6-screen-reader">${esc(t(`alert.${kind}`))}:</span> ${esc(title)}</p>
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
  channel: 'stable',  // 'stable', 'prerelease' or 'ci': where the UEFI images come from
  versions: null,     // firmware.json: { channels: { stable, prerelease, ci }, release, images }
  rk: null,           // worker proxy once the tool has loaded
  toolError: null,
  running: false,
  finished: false,
};

// A target as it is written: a UEFI target gets the file of the chosen
// channel, or is null when that channel has no image for the board.
function resolveTarget(board, target) {
  if (!target.image) return target;
  // firmware.json not loaded (yet): the stable files under their fixed names,
  // without a checksum to compare, as before there were channels.
  if (!state.versions?.channels) return state.channel === 'stable' ? target : null;
  return withImage(target, channelImage(state.versions, state.channel, board.id), state.channel);
}

function currentTarget() {
  if (!state.board || !state.targetId) return null;
  if (state.targetId === 'custom') return state.file ? customTarget(state.file) : null;
  const target = state.board.targets.find((x) => x.id === state.targetId);
  return target ? resolveTarget(state.board, target) : null;
}

function channelInfo(c = state.channel) {
  return state.versions?.channels?.[c] || null;
}

function stableVersionOf(board) {
  return channelImage(state.versions, 'stable', board.id)?.version || state.versions?.images?.[board.id] || null;
}

function shortSha(sha) { return sha ? sha.slice(0, 7) : t('ci.unknownCommit'); }
function commitLink(sha) {
  return sha ? `<a href="${REPO_URL}/commit/${encodeURIComponent(sha)}" target="_blank" rel="noopener"><span class="detail">${esc(sha.slice(0, 7))}</span></a>` : esc(t('ci.unknownCommit'));
}
function releaseLink(info) {
  return `<a href="${esc(info.url)}" target="_blank" rel="noopener">${esc(info.tag)}</a>`;
}
function when(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '?';
  return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(d);
}

// ── Notices above the wizard ───────────────────────────────────────────────
// Each notice is a function that returns its markup, so it follows the language.
const notices = new Map();
function setNotice(key, html) {
  if (html) notices.set(key, html); else notices.delete(key);
  renderNotices();
}
function renderNotices() {
  $('notices-body').innerHTML = `<div class="pf-v6-l-stack pf-m-gutter">${[...notices.values()].map((h) => `<div class="pf-v6-l-stack__item">${h()}</div>`).join('')}</div>`;
  $('notices').hidden = notices.size === 0;
}

// ── Step 1: board ──────────────────────────────────────────────────────────
// The boards as radios with a line under each, in Maskrom Studio's order.
const BOARD_ORDER = ['tspi3m', 'cm5io', 'rock4d'];
function renderBoards() {
  const order = (b) => { const i = BOARD_ORDER.indexOf(b.id); return i < 0 ? BOARD_ORDER.length : i; };
  $('board-radios').innerHTML = [...BOARDS].sort((a, b) => order(a) - order(b)).map((b) => {
    const checked = state.board === b;
    const desc = t('board.desc', { storage: tr(b.storage), version: stableVersionOf(b) || 'edk2-rk3576' });
    return `<div class="pf-v6-c-radio">
      <input class="pf-v6-c-radio__input" type="radio" name="board" id="board-${b.id}" value="${b.id}"${checked ? ' checked' : ''}>
      <label class="pf-v6-c-radio__label" for="board-${b.id}">${esc(b.name)}</label>
      <span class="pf-v6-c-radio__description">${esc(desc)}</span>
    </div>`;
  }).join('');
  const rel = state.versions?.release;
  $('release-note').innerHTML = rel
    ? t('board.note.release', { link: `<a href="${REPO_URL}/releases/tag/${encodeURIComponent(rel)}">${esc(rel)}</a>` })
    : t('board.note.latest', { link: `<a href="${REPO_URL}/releases/latest">${esc(t('board.note.latestLink'))}</a>` });
}

function chooseBoard(id) {
  if (state.running) return;
  const b = boardById(id);
  if (!b || b === state.board) return;
  state.board = b;
  state.targetId = b.targets[0].id;
  state.reached = Math.min(state.reached, 0);
  state.finished = false;
  // The radios already show the choice; drawing them again would take the
  // keyboard focus away from the one just chosen.
  render();
}

$('board-radios').addEventListener('change', (e) => {
  if (e.target.name === 'board') chooseBoard(e.target.value);
});

// ── Step 2: firmware ───────────────────────────────────────────────────────
// The channel choice: a PatternFly toggle group. A channel firmware.json does
// not have (the deploy could not bundle it, or there is no such release) is
// shown disabled.
function renderChannels() {
  const loaded = !!state.versions?.channels;
  $('channel-group').innerHTML = CHANNELS.map((c) => {
    const on = state.channel === c;
    const off = loaded ? !channelInfo(c) : c !== 'stable';
    return `<div class="pf-v6-c-toggle-group__item"><button type="button" class="pf-v6-c-toggle-group__button${on ? ' pf-m-selected' : ''}" data-channel="${c}" aria-pressed="${on}"${off ? ' disabled' : ''}><span class="pf-v6-c-toggle-group__text">${esc(t(`channel.${c}`))}</span></button></div>`;
  }).join('');
  const info = channelInfo();
  const stable = channelInfo('stable');
  let help;
  if (!loaded) help = state.channel === 'stable' ? '' : t('channel.loading');
  else if (!info) help = t('channel.unavailable');
  else if (state.channel === 'stable') help = t('channel.stable.desc', { tag: info.tag });
  else if (state.channel === 'prerelease') help = info.same ? t('channel.prerelease.same', { tag: info.tag }) : t('channel.prerelease.desc', { tag: info.tag });
  else help = t('channel.ci.desc');
  $('channel-help').textContent = help;
  $('channel-help-item').classList.toggle('pf-m-warning', state.channel === 'ci');

  // What the chosen pre-release or CI build is, when a UEFI image is chosen.
  const target = state.board?.targets.find((x) => x.id === state.targetId);
  let alert = '';
  if (info && target?.image) alert = channelAlert(info, stable);
  $('channel-alert').innerHTML = alert;
  $('channel-alert').hidden = !alert;
}

function channelAlert(info, stable) {
  if (state.channel === 'ci') {
    return alertHtml('warning', t('ci.title'), `<p>${t('ci.body', { commit: commitLink(info.commit), time: esc(when(info.published)) })}</p>`);
  }
  if (state.channel === 'prerelease' && !info.same) {
    return alertHtml('info', t('pre.title'), `<p>${t('pre.body', { tag: releaseLink(info), stable: stable ? esc(stable.tag) : '?' })}</p>`);
  }
  return '';
}

$('channel-group').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-channel]');
  if (!button || button.disabled || state.running || state.channel === button.dataset.channel) return;
  state.channel = button.dataset.channel;
  state.reached = Math.min(state.reached, 1);
  state.finished = false;
  $('ci-ack').checked = false;
  render();
});

function renderTargets() {
  const b = state.board;
  if (!b) return;
  $('firmware-lead').textContent = t('fw.lead', { storage: tr(b.storage), board: b.name });
  renderChannels();
  const rows = b.targets.map((x) => {
    const r = resolveTarget(b, x);
    return {
      id: x.id,
      label: x.image && r ? `${tr(x.label)} ${r.version || stableVersionOf(b) || ''}`.trim() : tr(x.label),
      note: r ? tr(x.note) : t('fw.notInChannel'),
      disabled: !r,
    };
  });
  rows.push({ id: 'custom', label: t('fw.custom'), note: t('fw.custom.note') });
  $('target-radios').innerHTML = rows.map((r) => `<div class="pf-v6-c-radio${r.disabled ? ' pf-m-disabled' : ''}">
      <input class="pf-v6-c-radio__input" type="radio" name="target" id="target-${r.id}" value="${r.id}"${state.targetId === r.id ? ' checked' : ''}${r.disabled ? ' disabled' : ''}>
      <label class="pf-v6-c-radio__label${r.disabled ? ' pf-m-disabled' : ''}" for="target-${r.id}">${esc(r.label)}</label>
      <span class="pf-v6-c-radio__description">${esc(r.note)}</span>
    </div>`).join('');
  $('file-row').hidden = state.targetId !== 'custom';
  $('file-name').textContent = state.file ? `${state.file.name}, ${(state.file.size / 1048576).toFixed(1)} MiB` : t('fw.noFile');
}

$('target-radios').addEventListener('change', (e) => {
  if (e.target.name !== 'target' || state.running) return;
  state.targetId = e.target.value;
  state.reached = Math.min(state.reached, 1);
  state.finished = false;
  $('ack').checked = false;
  $('ci-ack').checked = false;
  render();
  // render() draws the radios again: give the focus back to the chosen one.
  $(`target-${state.targetId}`)?.focus();
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
  const tg = currentTarget();
  if (!b || !tg) return;
  const v = tg.version || (tg.image ? stableVersionOf(b) : null);
  const what = tg.image && v ? `${tr(tg.label)} ${v}` : tr(tg.label);
  const size = tg.blob ? `${(tg.blob.size / 1048576).toFixed(1)} MiB`
    : tg.slice ? t('review.size.part', { mib: ((tg.slice[1] - tg.slice[0]) / 1048576).toFixed(1) }) : t('review.size.whole');
  const info = tg.image ? channelInfo(tg.channel || 'stable') : null;
  let source = '';
  if (info && tg.channel === 'ci') source = t('review.source.ci', { commit: commitLink(info.commit), time: esc(when(info.published)) });
  else if (info) source = t(info.prerelease && !info.same ? 'review.source.prerelease' : 'review.source.release', { link: releaseLink(info) });
  $('review').innerHTML = dl(t('review.board'), esc(b.name))
    + dl(t('review.firmware'), esc(what))
    + (source ? dl(t('review.source'), source) : '')
    + dl(t('review.file'), `<span class="detail">${esc(tg.fileName || tg.file)}</span>`)
    + (tg.sha256 ? dl(t('review.sha'), t('review.sha.value', { sha: `<span class="detail">${esc(tg.sha256)}</span>` })) : '')
    + dl(t('review.to'), esc(t('review.to.value', { storage: tr(b.storage), lba: tg.lba, size })));
  const isCi = tg.image && tg.channel === 'ci';
  $('review-alert').innerHTML = isCi && info ? channelAlert(info, channelInfo('stable')) : '';
  $('review-alert').hidden = !isCi;
  $('erase-alert').innerHTML = alertHtml('warning', t('review.replaces'), `<p>${esc(tr(tg.erases))}</p>`);
  $('maskrom-steps').innerHTML = b.maskrom.map((s) => `<li>${esc(tr(s))}</li>`).join('');
  const link = (b.maskromNote ? esc(tr(b.maskromNote)) + ' ' : '')
    + (b.maskromLink ? `<a href="${esc(b.maskromLink.href)}" target="_blank" rel="noopener">${esc(tr(b.maskromLink.text))}</a>. ` : '');
  $('maskrom-more').innerHTML = link + t('maskrom.more', {
    zadig: '<a href="https://zadig.akeo.ie/">Zadig</a>',
    docs: `<a href="https://edk2.gahingwoo.com/flash.html">${esc(t('maskrom.docs'))}</a>`,
  });
  $('ack-block').hidden = state.targetId !== 'custom';
  $('ci-ack-block').hidden = !isCi;
}

// Whether the write needs a box ticked first: a file from this computer, or a CI build.
function needsAck() {
  const target = currentTarget();
  if (state.targetId === 'custom' && !$('ack').checked) return true;
  return !!(target?.image && target.channel === 'ci' && !$('ci-ack').checked);
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
      $('run-alert').innerHTML = alertHtml('info', t('reconnect.title'),
        `<p>${esc(t('reconnect.body'))}</p>${failed ? `<p>${esc(failed)}</p>` : ''}`,
        `<button class="pf-v6-c-button pf-m-primary" type="button" id="reconnect"><span class="pf-v6-c-button__text">${esc(t('reconnect.button'))}</span></button>`);
      $('reconnect').addEventListener('click', async () => {
        try {
          await request();
          $('run-alert').innerHTML = '';
          resolve();
        } catch (e) {
          show(t('reconnect.retry'));
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
  setProgress(0, t('run.starting'));
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
          throw new Error(t('flash.download', { name: name.replace(/\?.*/, ''), why: e.message }));
        }
      },
      board, target,
      ui: { status: (t) => setProgress(null, t), log, progress: (p) => setProgress(p), reconnect },
    });
    setProgress(100, t('run.written'));
    $('run-alert').innerHTML = alertHtml('success', t('run.written'), `<p>${esc(tr(target.done))}</p>`);
    log('\n' + tr(target.done));
    state.finished = true;
  } catch (err) {
    const cancelled = err && err.name === 'NotFoundError';
    const message = cancelled ? t('run.noDevice.body') : (err.message || String(err));
    setProgress(null, t('run.stopped'));
    $('run-alert').innerHTML = alertHtml(cancelled ? 'info' : 'danger', cancelled ? t('run.noDevice') : t('run.failed'), `<p>${esc(message)}</p>`);
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
$('ci-ack').addEventListener('change', render);
$('lang-toggle').addEventListener('click', () => {
  setLang(getLang() === 'zh' ? 'en' : 'zh');
  applyStatic();
  renderNotices();
  renderBoards();
  render();
});

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
  $('toggle-name').textContent = t(STEP_KEYS[state.step]);

  if (state.step === 1) renderTargets();
  if (state.step === 2) renderReview();

  const next = $('next');
  const label = next.querySelector('.pf-v6-c-button__text');
  let note = '';
  if (state.step < 2) {
    label.textContent = t('next');
    next.disabled = !canLeave(state.step);
    if (state.step === 1 && state.targetId === 'custom' && !state.file) note = t('note.chooseFile');
  } else {
    label.textContent = state.running ? t('run.writing') : state.finished ? t('run.again') : t('run.connect');
    const needAck = needsAck();
    next.disabled = state.running || !state.rk || !navigator.usb || needAck;
    if (!navigator.usb) note = t('note.noUsb');
    else if (state.toolError) note = t('note.toolError');
    else if (!state.rk) note = t('note.loading');
    else if (needAck) note = t('note.ack');
    else if (state.running) note = t('note.running');
  }
  $('back').hidden = state.step === 0;
  $('back').disabled = state.running;
  $('footer-note').textContent = note;
}

// ── Start ──────────────────────────────────────────────────────────────────
applyStatic();
renderBoards();
render();

// no-cache: revalidated on every visit, so the page never pairs a new image
// with an old description of it (flash.js checks the SHA-256 as well).
fetch('./firmware.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((v) => {
  if (!v) return;
  state.versions = v;
  renderBoards();
  render();
});

if (!navigator.usb) {
  setNotice('usb', () => alertHtml('warning', t('notice.noUsb.title'), `<p>${esc(t('notice.noUsb.body'))}</p>`));
} else if (!self.crossOriginIsolated) {
  // The service worker in index.html reloads the page once it is installed.
  // If the page is still not isolated after that, say so.
  setTimeout(() => {
    if (!self.crossOriginIsolated && !state.rk) {
      state.toolError = 'not isolated';
      setNotice('tool', () => alertHtml('danger', t('notice.isolated.title'), `<p>${esc(t('notice.isolated.body'))}</p>`));
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
    setNotice('tool', () => alertHtml('danger', t('notice.tool.title'), `<p>${esc(state.toolError)}</p><p>${esc(t('notice.tool.reload'))}</p>`));
    render();
  });
}
