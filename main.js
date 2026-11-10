'use strict';
// Multipify Photo — processus principal Electron
const { app, BrowserWindow, ipcMain, dialog, Menu, clipboard, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let dirty = false;
let pendingPaths = [];

const OPENABLE = /\.(mpp|psd|png|jpe?g|webp|gif|bmp|svg|ico|avif|tiff?|dng|cr2|cr3|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|raw|rwl|3fr|erf|kdc|mos|x3f)$/i;
const filesFromArgv = (argv) => argv.slice(app.isPackaged ? 1 : 2).filter((a) => OPENABLE.test(a) && fs.existsSync(a));
const readEntry = (p) => ({ name: path.basename(p), path: p, data: new Uint8Array(fs.readFileSync(p)) });

function sendOpen(paths) {
  if (!paths.length) return;
  if (!win || win.webContents.isLoading()) { pendingPaths.push(...paths); return; }
  try { win.webContents.send('open-paths', paths.map(readEntry)); } catch (e) { dialog.showErrorBox('Multipify Photo', e.message); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640,
    backgroundColor: '#18181a', show: false, title: 'Multipify Photo',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('did-finish-load', () => { const p = pendingPaths; pendingPaths = []; sendOpen(p); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('close', (e) => {
    if (!dirty) return;
    const r = dialog.showMessageBoxSync(win, {
      type: 'warning', buttons: ['Quitter sans enregistrer', 'Annuler'], defaultId: 1, cancelId: 1,
      title: 'Multipify Photo', message: 'Certains documents contiennent des modifications non enregistrées.', detail: 'Voulez-vous vraiment quitter ?',
    });
    if (r === 1) e.preventDefault();
  });
  win.on('closed', () => { win = null; });
}

// une seule instance : un double-clic sur un fichier l'ouvre dans la fenêtre existante
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } sendOpen(filesFromArgv(argv)); });
  app.whenReady().then(() => {
    pendingPaths = filesFromArgv(process.argv);
    createWindow();
  });
  app.on('open-file', (e, p) => { e.preventDefault(); sendOpen([p]); }); // macOS
  app.on('window-all-closed', () => app.quit());
}

ipcMain.handle('open-files', async (_e, { filters, multi }) => {
  const r = await dialog.showOpenDialog(win, { properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters });
  if (r.canceled) return [];
  return r.filePaths.map(readEntry);
});
ipcMain.handle('read-file', async (_e, p) => (fs.existsSync(p) ? readEntry(p) : null));
ipcMain.handle('save-file', async (_e, { defaultPath, filters, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.isAbsolute(defaultPath) ? defaultPath : path.join(app.getPath('pictures'), defaultPath), filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(data));
  return r.filePath;
});
ipcMain.handle('pick-folder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]; });
ipcMain.handle('user-data-path', () => app.getPath('userData'));

// ---- v7 : collaboration par dossier partagé (OneDrive, Dropbox, Google Drive, réseau) ----
const os = require('os');
const watchers = new Map();
ipcMain.handle('watch-path', (_e, p) => { if (watchers.has(p)) return true; const fn = (cur, prev) => { if (cur.mtimeMs !== prev.mtimeMs && win) win.webContents.send('path-changed', p, cur.mtimeMs); }; fs.watchFile(p, { interval: 2000 }, fn); watchers.set(p, fn); return true; });
ipcMain.handle('unwatch-path', (_e, p) => { const fn = watchers.get(p); if (fn) { fs.unwatchFile(p, fn); watchers.delete(p); } return true; });
ipcMain.handle('file-stat', (_e, p) => { try { const s = fs.statSync(p); return { mtime: s.mtimeMs, size: s.size }; } catch (_) { return null; } });
ipcMain.handle('delete-file', (_e, p) => { try { fs.unlinkSync(p); return true; } catch (_) { return false; } });
ipcMain.handle('show-in-folder', (_e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.handle('user-info', () => ({ name: (() => { try { return os.userInfo().username; } catch (_) { return 'Utilisateur'; } })(), host: os.hostname() }));
ipcMain.handle('cloud-folders', () => {
  const home = os.homedir(), c = [];
  const add = (label, p) => { try { if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) c.push({ label, path: p }); } catch (_) { /* */ } };
  try { for (const n of fs.readdirSync(home)) if (/^OneDrive/i.test(n)) add(n.replace(/^OneDrive\s*-?\s*/, 'OneDrive ') || 'OneDrive', path.join(home, n)); } catch (_) { /* */ }
  if (process.env.OneDrive) add('OneDrive', process.env.OneDrive); if (process.env.OneDriveCommercial) add('OneDrive (entreprise)', process.env.OneDriveCommercial);
  add('Dropbox', path.join(home, 'Dropbox')); add('iCloud Drive', path.join(home, 'iCloudDrive')); add('Google Drive', path.join(home, 'Google Drive'));
  for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') { add('Google Drive (' + L + ':)', L + ':\\Mon Drive'); add('Google Drive (' + L + ':)', L + ':\\My Drive'); }
  const seen = new Set(); return c.filter((x) => (seen.has(x.path) ? false : seen.add(x.path)));
});


ipcMain.handle('find-camera-profiles', (_e, model, make) => {
  const roots = process.platform === 'win32' ? [path.join(process.env.ProgramData || 'C:\\ProgramData', 'Adobe', 'CameraRaw', 'CameraProfiles', 'Camera'), path.join(process.env.APPDATA || '', 'Adobe', 'CameraRaw', 'CameraProfiles')] : [path.join('/Library/Application Support/Adobe/CameraRaw/CameraProfiles/Camera'), path.join(os.homedir(), 'Library/Application Support/Adobe/CameraRaw/CameraProfiles')];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), want = norm(model), wantMk = norm(make), out = [];
  const walk = (dir, depth) => { if (depth > 4 || out.length > 20) return; let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; } for (const e of list) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, depth + 1); else if (/\.dcp$/i.test(e.name)) { const n = norm(p); if (n.includes(want) || (want.startsWith(wantMk) && n.includes(want.slice(wantMk.length)))) out.push(p); } } };
  roots.forEach((r) => walk(r, 0)); return out.sort((a, b) => (/standard/i.test(b) ? 1 : 0) - (/standard/i.test(a) ? 1 : 0));
});
ipcMain.handle('list-files', (_e, dir, prefix) => { try { return fs.readdirSync(dir).filter((n) => n.startsWith(prefix)).map((n) => path.join(dir, n)); } catch (_) { return []; } });

ipcMain.handle('open-external', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return true; });
ipcMain.handle('dng-convert', async (_e, src) => {
  const { execFile } = require('child_process');
  const cands = process.platform === 'win32' ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Adobe', 'Adobe DNG Converter', 'Adobe DNG Converter.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Adobe', 'Adobe DNG Converter', 'Adobe DNG Converter.exe')] : ['/Applications/Adobe DNG Converter.app/Contents/MacOS/Adobe DNG Converter'];
  const exe = cands.find((p) => fs.existsSync(p)); if (!exe) return { error: 'absent' };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mpdng-'));
  return new Promise((res) => execFile(exe, ['-c', '-p0', '-d', out, src], { timeout: 180000, windowsHide: true }, (err) => {
    const f = (() => { try { return fs.readdirSync(out).find((n) => /\.dng$/i.test(n)); } catch (_) { return null; } })();
    res(f ? { path: path.join(out, f) } : { error: err ? err.message : 'conversion impossible' });
  }));
});

let rtServer = null;
ipcMain.handle('rt-host-start', async (_e, port) => {
  if (rtServer) return rtServer.info;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  try { const s = await require('./collab-server.js').start({ port: port || 41700, code }); const ips = []; for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.push(a.address); rtServer = { s, info: { port: s.port, code, ips } }; return rtServer.info; }
  catch (e) { return { error: e.message }; }
});
ipcMain.handle('rt-host-stop', () => { if (rtServer) { rtServer.s.close(); rtServer = null; } return true; });
ipcMain.handle('write-file', async (_e, p, data) => { fs.writeFileSync(p, Buffer.from(data)); return p; });
ipcMain.handle('clipboard-read-image', () => { const img = clipboard.readImage(); return img.isEmpty() ? null : new Uint8Array(img.toPNG()); });
ipcMain.handle('clipboard-write-image', (_e, data) => { clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(data))); return true; });
// IA : aucun appel direct à OpenAI, tout passe par le serveur Multipify (photo-api).

/* ===== Licence Multipify Photo : identifiant de l'ordinateur, stockage protégé, appels au serveur ===== */
const MP_SERVER = String(process.env.MULTIPIFY_SERVER || 'https://multipify.eu').replace(/\/+$/, '');
let machineCache = null;
function machineInfo() {
  if (machineCache) return machineCache;
  const crypto = require('crypto'), { execSync } = require('child_process'); let raw = '';
  try {
    if (process.platform === 'win32') { const out = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { windowsHide: true, timeout: 5000 }).toString(); const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i); if (m) raw = m[1]; }
    else if (process.platform === 'darwin') { const out = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { timeout: 5000 }).toString(); const m = out.match(/"IOPlatformUUID" = "([^"]+)"/); if (m) raw = m[1]; }
    else { for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) { try { raw = fs.readFileSync(f, 'utf8').trim(); if (raw) break; } catch (_) { /* */ } } }
  } catch (_) { /* repli ci-dessous */ }
  if (!raw) { const macs = []; for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (!a.internal && a.mac && a.mac !== '00:00:00:00:00:00') macs.push(a.mac); raw = [os.hostname(), macs.sort()[0] || '', (os.cpus()[0] || {}).model || ''].join('|'); }
  machineCache = { id: crypto.createHash('sha256').update('multipify-photo|' + raw).digest('hex'), name: os.hostname().slice(0, 60), platform: process.platform + '-' + process.arch, version: app.getVersion() };
  return machineCache;
}
const licFile = () => path.join(app.getPath('userData'), 'licence.dat');
ipcMain.handle('license-machine', () => machineInfo());
ipcMain.handle('license-load', () => {
  try { const b = fs.readFileSync(licFile()); const { safeStorage } = require('electron'); const txt = b[0] === 0x7b ? b.toString('utf8') : (safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : ''); return JSON.parse(txt || '{}'); } catch (_) { return {}; }
});
ipcMain.handle('license-save', (_e, data) => {
  try { const txt = JSON.stringify(data || {}); const { safeStorage } = require('electron'); fs.mkdirSync(path.dirname(licFile()), { recursive: true }); fs.writeFileSync(licFile(), safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(txt) : Buffer.from(txt)); return true; } catch (_) { return false; }
});
ipcMain.handle('photo-api', async (_e, req) => {
  const p = String(req && req.path || ''); if (!/^\/api\/photo\/[a-z0-9/_-]+(\?[\w=&%.-]*)?$/i.test(p)) return { status: 400, json: { error: 'chemin refusé' } };
  const m = machineInfo(), headers = { 'Content-Type': 'application/json', 'X-Photo-Machine': m.id, 'User-Agent': 'MultipifyPhoto/' + m.version };
  if (req.token) headers['X-Photo-Token'] = String(req.token);
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), Number(req.timeout) || 240000);
  try {
    const r = await fetch(MP_SERVER + p, { method: req.method === 'GET' ? 'GET' : 'POST', headers, body: req.method === 'GET' ? undefined : JSON.stringify({ ...(req.body || {}), machineId: m.id }), signal: ac.signal });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) { j = { error: t.slice(0, 200) }; } return { status: r.status, json: j };
  } catch (e) { return { status: 0, json: { error: 'Connexion au serveur Multipify impossible : vérifiez votre accès Internet.', offline: true } }; }
  finally { clearTimeout(to); }
});
ipcMain.handle('photo-server', () => MP_SERVER);
ipcMain.on('set-dirty', (_e, v) => { dirty = !!v; });
ipcMain.on('toggle-fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));
ipcMain.on('quit', () => win && win.close());
ipcMain.on('renderer-ready', () => { const p = pendingPaths; pendingPaths = []; sendOpen(p); });
