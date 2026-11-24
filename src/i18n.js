// English and Simplified Chinese. The language is localStorage.lang ("en" or
// "zh") when the masthead button has set it, else the browser's.
//
//   t(key, vars)  a message below, with {name} replaced from vars
//   L(en, zh)     a text with both languages, for boards.js
//   tr(text)      a string, or an L() text in the current language

const M = {
  // page
  'page.title': ['RK3576 firmware flash', 'RK3576 固件刷写'],
  'page.docs': ['Documentation', '文档'],
  'page.releases': ['Releases', '发布'],
  'page.lang': ['English', '简体中文'],
  'page.lang.aria': ['Display language', '显示语言'],
  'step.board': ['Board', '开发板'],
  'step.firmware': ['What to write', '写入内容'],
  'step.write': ['Review', '确认'],
  'steps': ['Steps', '步骤'],
  'back': ['Back', '上一步'],
  'next': ['Next', '下一步'],

  'alert.info': ['Info alert', '提示'],
  'alert.success': ['Success alert', '成功'],
  'alert.warning': ['Warning alert', '警告'],
  'alert.danger': ['Danger alert', '错误'],

  // step 1
  'board.lead': ['The board to write. Each one says where its firmware goes.', '选择要写入的开发板。每块板下面写着它的固件装在哪里。'],
  'board.label': ['Board', '开发板'],
  'board.desc': ['Firmware on the {storage}; UEFI firmware {version}.', '固件位于 {storage}；UEFI 固件 {version}。'],
  'board.note.release': ['The UEFI images come from edk2-rk3576 release {link}. A board whose image did not change in that release keeps its older version. Pre-releases and CI builds can be chosen in the next step.',
    'UEFI 镜像来自 edk2-rk3576 正式版 {link}。该版本没有改动的开发板沿用较早的版本。预发布版和 CI 构建可以在下一步选择。'],
  'board.note.latest': ['The UEFI images come from the latest {link}.', 'UEFI 镜像来自最新的 {link}。'],
  'board.note.latestLink': ['edk2-rk3576 release', 'edk2-rk3576 正式版'],

  // step 2
  'fw.lead': ['For the {storage} of the {board}.', '写入 {board} 的 {storage}。'],
  'fw.custom': ['A file from this computer', '这台电脑上的文件'],
  'fw.custom.note': ['Any .img or .bin, written from sector 0.', '任意 .img 或 .bin 文件，从扇区 0 开始写入。'],
  'fw.chooseFile': ['Choose a file', '选择文件'],
  'fw.noFile': ['No file chosen', '未选择文件'],
  'fw.notInChannel': ['This build has no image for this board.', '这个构建没有这块开发板的镜像。'],
  'channel.label': ['UEFI firmware from', 'UEFI 固件来源'],
  'channel.stable': ['Release', '正式版'],
  'channel.prerelease': ['Pre-release', '预发布版'],
  'channel.ci': ['CI build', 'CI 构建'],
  'channel.stable.desc': ['The latest release, {tag}. Recommended.', '最新正式版 {tag}。推荐使用。'],
  'channel.prerelease.desc': ['The newest release, pre-releases included: {tag}. Newer than the release and less tried.', '包括预发布版在内最新的发布：{tag}。比正式版新，但测试更少。'],
  'channel.prerelease.same': ['There is no pre-release newer than release {tag}, so this is the same firmware as Release.', '目前没有比正式版 {tag} 更新的预发布版，所以这里与正式版是同一个固件。'],
  'channel.ci.desc': ['The latest successful build of main. It has not been run on a board.', 'main 分支最新一次成功构建，没有在开发板上运行过。'],
  'channel.unavailable': ['Not on this site at the moment.', '本站目前没有。'],
  'channel.loading': ['Loading the list of builds.', '正在读取构建列表。'],
  'ci.title': ['CI build, not tested on a board', 'CI 构建，未在开发板上验证'],
  'ci.body': ['This is commit {commit} of edk2-rk3576, built {time}. Nobody has run it on a board: it may not start, or may have bugs that a release would not. Use it to try a fix before it is released. MaskROM always works, so a release can be written back the same way.',
    '这是 edk2-rk3576 的提交 {commit}，构建于 {time}。还没有人在开发板上运行过它：可能无法启动，也可能有正式版没有的问题。适合在修复发布之前先试用。MaskROM 始终可用，所以可以用同样的方法写回正式版。'],
  'ci.unknownCommit': ['(unknown)', '（未知）'],
  'pre.title': ['Pre-release', '预发布版'],
  'pre.body': ['{tag} is a pre-release: newer than release {stable} and less tried.', '{tag} 是预发布版：比正式版 {stable} 新，但测试更少。'],

  // step 3
  'write.lead': ['Nothing has been written yet. Check this before you go on.', '尚未写入任何内容。继续之前请核对以下信息。'],
  'review.board': ['Board', '开发板'],
  'review.firmware': ['Firmware', '固件'],
  'review.source': ['From', '来源'],
  'review.source.release': ['edk2-rk3576 release {link}', 'edk2-rk3576 正式版 {link}'],
  'review.source.prerelease': ['edk2-rk3576 pre-release {link}', 'edk2-rk3576 预发布版 {link}'],
  'review.source.ci': ['edk2-rk3576 CI build of commit {commit}, built {time}. Not run on a board.', 'edk2-rk3576 提交 {commit} 的 CI 构建，构建于 {time}。未在开发板上运行过。'],
  'review.file': ['File', '文件'],
  'review.sha': ['SHA-256', 'SHA-256'],
  'review.sha.value': ['{sha}, checked after the download', '{sha}，下载后校验'],
  'review.to': ['Written to', '写入位置'],
  'review.to.value': ['{storage}, from sector {lba}, {size}', '{storage}，从扇区 {lba} 开始，{size}'],
  'review.size.part': ['{mib} MiB of the image', '镜像中的 {mib} MiB'],
  'review.size.whole': ['the whole image', '整个镜像'],
  'review.replaces': ['What this replaces', '会被替换的内容'],
  'maskrom.title': ['Put the board in MaskROM mode', '让开发板进入 MaskROM 模式'],
  'maskrom.more': ['Linux and macOS need no driver. On Windows the device needs the WinUSB driver, installed with {zadig}. More in the {docs}.',
    'Linux 和 macOS 不需要驱动。Windows 上该设备需要 WinUSB 驱动，可用 {zadig} 安装。详见{docs}。'],
  'maskrom.docs': ['flashing instructions', '刷写说明'],
  'ack.custom': ['This file is an image for this board and this storage.', '这个文件是为这块开发板和这个存储制作的镜像。'],
  'ack.ci': ['I understand that this CI build has not been tested on a board and may not work.', '我知道这个 CI 构建未在开发板上验证，可能无法正常工作。'],
  'run.connect': ['Connect and write', '连接并写入'],
  'run.writing': ['Writing', '正在写入'],
  'run.again': ['Write again', '再次写入'],
  'run.starting': ['Starting', '正在开始'],
  'run.written': ['Written', '已写入'],
  'run.stopped': ['Stopped', '已停止'],
  'run.log': ['Log', '日志'],
  'run.failed': ['The write did not finish', '写入没有完成'],
  'run.noDevice': ['No device chosen', '未选择设备'],
  'run.noDevice.body': ['No device was chosen. Nothing was written.', '没有选择设备。未写入任何内容。'],
  'reconnect.title': ['Choose the board again', '再次选择开发板'],
  'reconnect.body': ['The loader is running and the board has come back as a new USB device. Reconnect the cable if the board does not show up.', '加载程序已在运行，开发板以新的 USB 设备重新出现。如果没有出现，请重新插拔数据线。'],
  'reconnect.button': ['Choose the board', '选择开发板'],
  'reconnect.retry': ['No device was chosen. Try again.', '没有选择设备，请重试。'],
  'note.chooseFile': ['Choose a file first.', '请先选择文件。'],
  'note.noUsb': ['This browser cannot reach USB devices.', '这个浏览器无法访问 USB 设备。'],
  'note.toolError': ['The write tool did not load.', '写入工具没有加载。'],
  'note.loading': ['Loading the write tool.', '正在加载写入工具。'],
  'note.ack': ['Tick the box at the end of this page first.', '请先勾选本页末尾的确认框。'],
  'note.running': ['Keep this page open and the cable connected.', '请保持此页面打开、数据线连接。'],
  'notice.noUsb.title': ['This browser cannot reach USB devices', '这个浏览器无法访问 USB 设备'],
  'notice.noUsb.body': ['Writing needs WebUSB, which Chrome and Edge have on a computer. You can still look through the steps here.', '写入需要 WebUSB，电脑上的 Chrome 和 Edge 支持。你仍然可以在这里浏览各个步骤。'],
  'notice.isolated.title': ['The write tool could not start', '写入工具无法启动'],
  'notice.isolated.body': ['This page could not turn on cross-origin isolation, which the USB code needs. Reload the page; a private window or blocked service workers prevent it.', '此页面无法开启 USB 代码所需的跨源隔离。请重新加载页面；无痕窗口或被阻止的 Service Worker 会导致这个问题。'],
  'notice.tool.title': ['The write tool did not load', '写入工具没有加载'],
  'notice.tool.reload': ['Reload the page to try again.', '重新加载页面再试一次。'],

  // flash.js
  'flash.download': ['Could not download {name} ({why}). Nothing was written.', '无法下载 {name}（{why}）。未写入任何内容。'],
  'flash.sector': ['The image part does not start and end on a sector.', '镜像片段的起止位置没有对齐扇区。'],
  'flash.short': ['The image is {size} bytes, shorter than the {end} bytes this write expects. Nothing was written.', '镜像为 {size} 字节，短于这次写入需要的 {end} 字节。未写入任何内容。'],
  'flash.empty': ['The image is empty. Nothing was written.', '镜像为空。未写入任何内容。'],
  'flash.fit': ['The image does not fit the {storage} ({mib} MiB). Nothing was written.', '镜像超出 {storage} 的容量（{mib} MiB）。未写入任何内容。'],
  'flash.checksum': ['The downloaded {name} does not match its SHA-256 ({got} instead of {want}). Reload the page and try again. Nothing was written.', '下载的 {name} 与其 SHA-256 不符（得到 {got}，应为 {want}）。请重新加载页面再试。未写入任何内容。'],
  'flash.size': ['The downloaded {name} is {size} bytes, not the {want} bytes it should be. Reload the page and try again. Nothing was written.', '下载的 {name} 为 {size} 字节，应为 {want} 字节。请重新加载页面再试。未写入任何内容。'],
  'flash.noFit': ['The image has no FIT at sector {lba}.', '镜像在扇区 {lba} 处没有 FIT。'],
  'flash.fitLarge': ['The FIT header in the image is larger than expected.', '镜像中的 FIT 头比预期的大。'],
  'flash.noNvdata': ['The FIT in the image has no nvdata (UEFI settings) slot.', '镜像中的 FIT 没有 nvdata（UEFI 设置）区。'],
  'flash.nvMoved': ['The UEFI settings slot in this image starts at byte {at}, not at {want} where this write stops, so it cannot keep the settings.', '此镜像中的 UEFI 设置区从字节 {at} 开始，而不是这次写入停止的 {want}，因此无法保留设置。'],
  'flash.nothing': ['{why} Nothing was written.', '{why}未写入任何内容。'],
  'flash.db': ['Sending the loader failed (rkdeveloptool db, exit {code}). Nothing was written.', '发送加载程序失败（rkdeveloptool db，退出码 {code}）。未写入任何内容。'],
  'flash.wl': ['The write failed (rkdeveloptool wl, exit {code}). The {storage} may be partly written: write it again.', '写入失败（rkdeveloptool wl，退出码 {code}）。{storage} 可能只写入了一部分：请重新写入。'],
  'status.choose': ['Choose the Rockchip device in the browser prompt', '在浏览器弹窗中选择 Rockchip 设备'],
  'status.downloads': ['Waiting for the downloads', '正在等待下载'],
  'status.checking': ['Checking the download', '正在校验下载内容'],
  'status.loader': ['Sending the loader', '正在发送加载程序'],
  'status.again': ['Choose the board again', '再次选择开发板'],
  'status.writing': ['Writing to the {storage}', '正在写入{storage}'],
};

const STORE = 'lang';
let lang = (() => {
  try {
    const s = localStorage.getItem(STORE);
    if (s === 'en' || s === 'zh') return s;
  } catch (e) { /* no storage */ }
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  return /^zh\b/i.test(langs[0] || '') ? 'zh' : 'en';
})();

export function getLang() { return lang; }
export function locale() { return lang === 'zh' ? 'zh-CN' : 'en'; }

export function setLang(l, remember = true) {
  lang = l === 'zh' ? 'zh' : 'en';
  if (remember) { try { localStorage.setItem(STORE, lang); } catch (e) { /* no storage */ } }
  if (typeof document !== 'undefined') document.documentElement.lang = locale();
}

export function t(key, vars) {
  const m = M[key];
  let s = m ? m[lang === 'zh' ? 1 : 0] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
  return s;
}

export function L(en, zh) { return { en, zh }; }
export function tr(v) { return v == null || typeof v === 'string' ? v : (v[lang] ?? v.en); }

// Text of the elements marked data-i18n="key" (and aria-label of data-i18n-aria).
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.setAttribute('title', t(el.dataset.i18nTitle)); });
  document.title = t('page.title');
}

setLang(lang, false);
