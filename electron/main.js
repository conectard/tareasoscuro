// Proceso principal: ventana tipo widget anclada a una esquina de la pantalla.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const MARGIN = 12;
const SIZES = { widget: { w: 340, h: 540 }, full: { w: 440, h: 780 } };
const SHORTCUT = 'CommandOrControl+Alt+T';
const CORNERS = { tl: 'Arriba a la izquierda', tr: 'Arriba a la derecha', bl: 'Abajo a la izquierda', br: 'Abajo a la derecha' };

let win = null;
let tray = null;
let quitting = false;
let ignoreMovesUntil = 0;
const cfg = { corner: 'br', pinned: true, full: false, pos: null, size: {} };
const cfgFile = () => path.join(app.getPath('userData'), 'widget.json');

function loadCfg() {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgFile(), 'utf8'))); } catch { /* primera ejecución */ }
}
function saveCfg() {
  try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); } catch { /* sin permisos: se ignora */ }
}
const mode = () => (cfg.full ? 'full' : 'widget');
const state = () => ({ pinned: cfg.pinned, full: cfg.full, corner: cfg.corner, platform: process.platform });
const clamp = (v, a, b) => Math.max(a, Math.min(v, b));

// Calcula la posición: en una esquina, o donde el usuario lo arrastró.
function computeBounds() {
  const sz = cfg.size[mode()] || SIZES[mode()];
  const cur = win ? win.getBounds()
    : cfg.corner === 'custom' && cfg.pos ? { ...cfg.pos, width: sz.w, height: sz.h } : null;
  const wa = (cur ? screen.getDisplayMatching(cur) : screen.getPrimaryDisplay()).workArea;
  const w = Math.min(sz.w, wa.width - 2 * MARGIN);
  const h = Math.min(sz.h, wa.height - 2 * MARGIN);
  let x, y;
  if (cfg.corner !== 'custom' || !cur) {
    const c = CORNERS[cfg.corner] ? cfg.corner : 'br';
    x = c[1] === 'l' ? wa.x + MARGIN : wa.x + wa.width - w - MARGIN;
    y = c[0] === 't' ? wa.y + MARGIN : wa.y + wa.height - h - MARGIN;
  } else {
    // Posición libre: crece/encoge desde la esquina más cercana para no salirse
    const right = cur.x + cur.width / 2 > wa.x + wa.width / 2;
    const bottom = cur.y + cur.height / 2 > wa.y + wa.height / 2;
    x = right ? cur.x + cur.width - w : cur.x;
    y = bottom ? cur.y + cur.height - h : cur.y;
  }
  return {
    x: Math.round(clamp(x, wa.x, wa.x + wa.width - w)),
    y: Math.round(clamp(y, wa.y, wa.y + wa.height - h)),
    width: w,
    height: h,
  };
}
function place() {
  if (!win) return;
  ignoreMovesUntil = Date.now() + 700;
  win.setBounds(computeBounds());
}
function broadcast() {
  if (win) win.webContents.send('desk:state', state());
  buildMenu();
}

function createWindow() {
  win = new BrowserWindow({
    ...computeBounds(),
    minWidth: 300,
    minHeight: 360,
    frame: false,
    show: false,
    resizable: true, // en Windows 11 además activa las esquinas redondeadas nativas
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: cfg.pinned,
    // Fondo opaco: mantiene el antialiasing ClearType del texto (las ventanas transparentes lo pierden)
    backgroundColor: '#0b1119',
    title: 'TareasOscuro',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required', // para que suenen los recordatorios
    },
  });
  if (cfg.pinned) win.setAlwaysOnTop(true, 'floating');
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Seguridad: nada de navegar fuera ni abrir ventanas nuevas
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('moved', () => {
    if (Date.now() < ignoreMovesUntil) return;
    const b = win.getBounds();
    cfg.corner = 'custom';
    cfg.pos = { x: b.x, y: b.y };
    saveCfg();
    buildMenu();
  });
  win.on('resized', () => {
    if (Date.now() < ignoreMovesUntil) return;
    const b = win.getBounds();
    cfg.size[mode()] = { w: b.width, h: b.height };
    if (cfg.corner === 'custom') cfg.pos = { x: b.x, y: b.y };
    saveCfg();
  });
}

function toggle() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) win.hide();
  else { win.show(); win.focus(); }
}
function setPinned(on) {
  cfg.pinned = on;
  win.setAlwaysOnTop(on, 'floating');
  saveCfg();
  broadcast();
}
function setFull(on) {
  cfg.full = on;
  place();
  saveCfg();
  broadcast();
}
function setCorner(c) {
  cfg.corner = c;
  cfg.pos = null;
  place();
  saveCfg();
  broadcast();
  win.show();
}

function buildMenu() {
  if (!tray) return;
  const canAutostart = app.isPackaged && process.platform !== 'linux';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar / ocultar', accelerator: SHORTCUT, click: toggle },
    { type: 'separator' },
    { label: 'Vista completa', type: 'checkbox', checked: cfg.full, click: (i) => setFull(i.checked) },
    { label: 'Siempre encima', type: 'checkbox', checked: cfg.pinned, click: (i) => setPinned(i.checked) },
    {
      label: 'Posición',
      submenu: Object.entries(CORNERS).map(([k, label]) => ({
        label, type: 'radio', checked: cfg.corner === k, click: () => setCorner(k),
      })),
    },
    {
      label: 'Restablecer tamaño',
      click: () => { cfg.size = {}; place(); saveCfg(); },
    },
    { type: 'separator' },
    {
      label: 'Iniciar con el sistema',
      type: 'checkbox',
      enabled: canAutostart,
      checked: canAutostart && app.getLoginItemSettings().openAtLogin,
      click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
    },
    { type: 'separator' },
    { label: 'Salir', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(img);
  tray.setToolTip('TareasOscuro');
  tray.on('click', toggle);
  buildMenu();
}

ipcMain.handle('desk:state', () => state());
ipcMain.handle('desk:pin', (_e, on) => { setPinned(on); return state(); });
ipcMain.handle('desk:full', (_e, on) => { setFull(on); return state(); });
ipcMain.on('desk:hide', () => win && win.hide());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  if (process.platform === 'win32') app.setAppUserModelId('io.github.tareasoscuro'); // notificaciones nativas
  app.whenReady().then(() => {
    loadCfg();
    if (process.platform === 'darwin' && app.dock) app.dock.hide();
    createWindow();
    createTray();
    globalShortcut.register(SHORTCUT, toggle);
    const relayout = () => { if (cfg.corner !== 'custom') place(); };
    screen.on('display-metrics-changed', relayout);
    screen.on('display-added', relayout);
    screen.on('display-removed', () => place());
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', (e) => e.preventDefault());
}
