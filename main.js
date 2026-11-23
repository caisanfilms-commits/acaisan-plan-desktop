/* ACAISAN PLAN para computador (Electron).
   Janela própria com barra de título da ACAISAN, tela de abertura e tela "Sem conexão".
   Dentro dela roda a mesma ACAISAN PLAN (https://acaisanplan.com/app.html): mesma conta, mesmos dados, sempre atualizada.
   Segurança: o conteúdo roda isolado (sandbox, contextIsolation, sem Node). A janela só navega na ACAISAN PLAN e nas
   páginas de pagamento da Stripe; qualquer outro link abre no navegador padrão. */
'use strict';
const { app, BaseWindow, BrowserWindow, WebContentsView, Menu, ipcMain, shell, session, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const DEV = !app.isPackaged;
const HOME = (DEV && process.env.AC_DESKTOP_URL) || 'https://acaisanplan.com/app.html';
const HOME_URL = new URL(HOME);
const APP_HOSTS = new Set(['acaisanplan.com', 'www.acaisanplan.com', 'beta.acaisanplan.com']);
if (DEV) APP_HOSTS.add(HOME_URL.host);
const PAY_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com', 'pay.stripe.com']);
const TITLE_H = 40;
const BG = '#0a0a0a';
const SMOKE = DEV && process.argv.includes('--ac-smoke');
const PARTITION = 'persist:acaisan';

app.setName('ACAISAN PLAN');
app.setAppUserModelId('com.acaisanplan.desktop');
nativeTheme.themeSource = 'dark';

// ── uma instância só (abrir de novo traz a janela para frente)
if (!SMOKE && !app.requestSingleInstanceLock()) { app.quit(); }
if (!DEV) app.setAsDefaultProtocolClient('acaisanplan');

const isApp = u => { try { const x = new URL(u); return x.protocol === (DEV ? x.protocol : 'https:') && APP_HOSTS.has(x.host); } catch (_) { return false; } };
const isPay = u => { try { const x = new URL(u); return x.protocol === 'https:' && PAY_HOSTS.has(x.host); } catch (_) { return false; } };
function openOutside(u) {
  try {
    const x = new URL(u);
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(x.protocol)) shell.openExternal(x.toString());
  } catch (_) {}
}

// ── posição e tamanho da janela entre aberturas
const stateFile = () => path.join(app.getPath('userData'), 'janela.json');
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(s).workArea;
    if (s.width >= 900 && s.height >= 600 && s.x >= area.x - 50 && s.y >= area.y - 50) return s;
  } catch (_) {}
  const wa = screen.getPrimaryDisplay().workAreaSize;
  return { width: Math.min(1440, wa.width), height: Math.min(900, wa.height), maximized: wa.width < 1500 };
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch (_) {}
}

let win = null, titlebar = null, content = null, overlay = null, overlayKind = '';
let updateReady = false;

function securePrefs(extra) {
  return Object.assign({ contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: true, partition: PARTITION }, extra || {});
}
function send(channel, payload) { if (titlebar && !titlebar.webContents.isDestroyed()) titlebar.webContents.send(channel, payload); }
function navState() {
  if (!content) return;
  const h = content.webContents.navigationHistory;
  send('ac:nav', { canBack: h.canGoBack(), canForward: h.canGoForward(), loading: content.webContents.isLoading(), online: overlayKind !== 'offline', updateReady });
}

function layout() {
  if (!win) return;
  const { width, height } = win.getContentBounds();
  titlebar.setBounds({ x: 0, y: 0, width, height: TITLE_H });
  content.setBounds({ x: 0, y: TITLE_H, width, height: Math.max(0, height - TITLE_H) });
  if (overlay) overlay.setBounds({ x: 0, y: TITLE_H, width, height: Math.max(0, height - TITLE_H) });
}

// Tela de abertura e "Sem conexão" ficam por cima do conteúdo até a ACAISAN PLAN carregar
function showOverlay(kind) {
  if (overlayKind === kind && overlay) return;
  hideOverlay();
  overlayKind = kind;
  overlay = new WebContentsView({ webPreferences: securePrefs({ preload: path.join(__dirname, 'preload-titlebar.js'), partition: undefined }) });
  overlay.setBackgroundColor(BG);
  win.contentView.addChildView(overlay);
  overlay.webContents.loadFile(path.join(__dirname, 'shell', kind === 'offline' ? 'offline.html' : 'boot.html'));
  layout();
  navState();
}
function hideOverlay() {
  if (!overlay) return;
  try { win.contentView.removeChildView(overlay); overlay.webContents.close(); } catch (_) {}
  overlay = null; overlayKind = '';
  navState();
}

const guarded = new WeakSet();
function guardContents(wc) {
  if (guarded.has(wc)) return;
  guarded.add(wc);
  // navegação dentro da janela: só ACAISAN PLAN e pagamento; o resto abre no navegador padrão
  wc.on('will-navigate', (e, url) => { if (!isApp(url) && !isPay(url)) { e.preventDefault(); openOutside(url); } });
  wc.on('will-redirect', (e, url) => { if (!isApp(url) && !isPay(url)) { e.preventDefault(); openOutside(url); } });
  wc.setWindowOpenHandler(({ url }) => {
    if (isApp(url)) {
      // ex.: o PRESENT abre em janela própria, com o mesmo isolamento
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1360, height: 860, backgroundColor: BG, autoHideMenuBar: true, title: 'ACAISAN PRESENT',
        icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: securePrefs({ preload: path.join(__dirname, 'preload-content.js') })
      } };
    }
    openOutside(url);
    return { action: 'deny' };
  });
}

function createWindow() {
  const st = loadState();
  win = new BaseWindow({
    width: st.width, height: st.height, x: st.x, y: st.y, minWidth: 900, minHeight: 600,
    backgroundColor: BG, show: false, title: 'ACAISAN PLAN',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0a0a', symbolColor: '#d4d4d8', height: TITLE_H }
  });

  titlebar = new WebContentsView({ webPreferences: securePrefs({ preload: path.join(__dirname, 'preload-titlebar.js'), partition: undefined }) });
  titlebar.setBackgroundColor(BG);
  content = new WebContentsView({ webPreferences: securePrefs({ preload: path.join(__dirname, 'preload-content.js') }) });
  content.setBackgroundColor(BG);
  win.contentView.addChildView(content);
  win.contentView.addChildView(titlebar);
  titlebar.webContents.loadFile(path.join(__dirname, 'shell', 'titlebar.html'));

  const wc = content.webContents;
  wc.setUserAgent(wc.getUserAgent() + ' AcaisanPlanDesktop/' + app.getVersion());
  guardContents(wc);
  wc.on('did-start-loading', navState);
  wc.on('did-stop-loading', navState);
  wc.on('did-navigate', navState);
  wc.on('did-navigate-in-page', navState);
  wc.on('page-title-updated', (_e, title) => send('ac:title', title));
  wc.on('did-finish-load', () => { if (overlayKind === 'boot') setTimeout(hideOverlay, 250); else if (overlayKind === 'offline') hideOverlay(); });
  wc.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return;   // -3: navegação cancelada (normal em redirecionamentos)
    showOverlay('offline');
  });
  wc.on('render-process-gone', () => showOverlay('offline'));

  showOverlay('boot');
  wc.loadURL(HOME);
  win.on('resize', layout);
  win.on('maximize', layout);
  win.on('unmaximize', layout);
  win.on('close', () => saveState(win));
  win.on('closed', () => { win = null; });
  layout();
  if (st.maximized) win.maximize();
  win.show();
}

// ── ações da barra de título
ipcMain.on('ac:back', () => { if (content && content.webContents.navigationHistory.canGoBack()) content.webContents.navigationHistory.goBack(); });
ipcMain.on('ac:forward', () => { if (content && content.webContents.navigationHistory.canGoForward()) content.webContents.navigationHistory.goForward(); });
ipcMain.on('ac:reload', () => { if (!content) return; if (overlayKind === 'offline') { showOverlay('boot'); content.webContents.loadURL(HOME); } else content.webContents.reload(); });
ipcMain.on('ac:home', () => { if (content) content.webContents.loadURL(HOME); });
ipcMain.on('ac:update', () => { if (updateReady) { try { require('electron-updater').autoUpdater.quitAndInstall(false, true); } catch (_) {} } });
ipcMain.on('ac:section', (_e, label) => send('ac:section', typeof label === 'string' ? label.slice(0, 40) : ''));
ipcMain.handle('ac:info', () => ({ version: app.getVersion(), dev: DEV }));

// ── menu (oculto na janela, mas os atalhos funcionam)
function buildMenu() {
  const zoom = d => { if (!content) return; const z = content.webContents.getZoomLevel(); content.webContents.setZoomLevel(d === 0 ? 0 : Math.max(-3, Math.min(3, z + d))); };
  const tpl = [
    { label: 'ACAISAN PLAN', submenu: [
      { label: 'Início', accelerator: 'CmdOrCtrl+Shift+H', click: () => ipcMain.emit('ac:home') },
      { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => content && content.webContents.reload() },
      { label: 'Recarregar sem cache', accelerator: 'CmdOrCtrl+Shift+R', click: () => content && content.webContents.reloadIgnoringCache() },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' }
    ] },
    { label: 'Editar', submenu: [{ role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { type: 'separator' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }] },
    { label: 'Navegar', submenu: [
      { label: 'Voltar', accelerator: 'Alt+Left', click: () => ipcMain.emit('ac:back') },
      { label: 'Avançar', accelerator: 'Alt+Right', click: () => ipcMain.emit('ac:forward') }
    ] },
    { label: 'Exibir', submenu: [
      { label: 'Aumentar zoom', accelerator: 'CmdOrCtrl+=', click: () => zoom(0.5) },
      { label: 'Aumentar zoom', accelerator: 'CmdOrCtrl+Plus', visible: false, click: () => zoom(0.5) },
      { label: 'Diminuir zoom', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.5) },
      { label: 'Tamanho original', accelerator: 'CmdOrCtrl+0', click: () => zoom(0) },
      { type: 'separator' },
      { label: 'Tela cheia', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) }
    ].concat(DEV ? [{ label: 'Ferramentas de desenvolvedor', accelerator: 'CmdOrCtrl+Shift+I', click: () => content && content.webContents.openDevTools({ mode: 'detach' }) }] : []) }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ── permissões: só o necessário, e só para a ACAISAN PLAN
function setupSession() {
  const ses = session.fromPartition(PARTITION);
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen', 'media']);
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(allowed.has(permission) && isApp(details.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && isApp(origin || (wc && wc.getURL()) || ''));
}

// ── atualização automática (GitHub Releases), só no app instalado
function setupUpdates() {
  if (DEV) return;
  let au;
  try { au = require('electron-updater').autoUpdater; } catch (_) { return; }
  au.autoDownload = true;
  au.autoInstallOnAppQuit = true;
  au.on('update-downloaded', () => { updateReady = true; navState(); });
  au.on('error', () => {});
  const check = () => au.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

// ── link acaisanplan://... (ex.: "Abrir no app" no site)
function handleDeepLink(argv) {
  const link = (argv || []).find(a => typeof a === 'string' && a.startsWith('acaisanplan://'));
  if (!link || !content) return;
  try {
    const u = new URL(link);
    const target = new URL(((u.host ? '/' + u.host : '') + u.pathname).replace(/^\/+/, '/') || '/app.html', HOME_URL.origin);
    if (isApp(target.toString())) content.webContents.loadURL(target.toString());
  } catch (_) {}
}
app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  handleDeepLink(argv);
});

// ── teste visual em desenvolvimento: npm run smoke -- --ac-shot=<pasta>
async function smoke() {
  const arg = process.argv.find(a => a.startsWith('--ac-shot='));
  const dir = arg ? arg.slice(10) : path.join(__dirname, 'out');
  fs.mkdirSync(dir, { recursive: true });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async (name) => {
    const t = await titlebar.webContents.capturePage();
    const c = await (overlay || content).webContents.capturePage();
    fs.writeFileSync(path.join(dir, name + '-barra.png'), t.toPNG());
    fs.writeFileSync(path.join(dir, name + '-conteudo.png'), c.toPNG());
  };
  await wait(1200); await shot('1-abertura');
  await wait(9000); await shot('2-app');
  showOverlay('offline'); await wait(1200); await shot('3-sem-conexao');
  fs.writeFileSync(path.join(dir, 'estado.json'), JSON.stringify({ url: content.webContents.getURL(), title: content.webContents.getTitle(), ua: content.webContents.getUserAgent() }, null, 2));
  app.quit();
}

app.whenReady().then(() => {
  setupSession();
  buildMenu();
  createWindow();
  setupUpdates();
  handleDeepLink(process.argv);
  if (SMOKE) smoke();
});
app.on('window-all-closed', () => app.quit());
app.on('web-contents-created', (_e, wc) => {
  // qualquer janela nova (ex.: PRESENT) segue as mesmas regras de navegação
  wc.on('did-attach-webview', e => e.preventDefault());
  wc.on('will-attach-webview', e => e.preventDefault());
  if (wc.getType() === 'window') guardContents(wc);
});
