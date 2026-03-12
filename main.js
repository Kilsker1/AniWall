const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path      = require('path');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const os        = require('os');
const { execFile } = require('child_process');

// ── Settings persistence ──────────────────────────────────────────────────────
let settingsPath; 

const DEFAULT_SETTINGS = {
  wallhaven: {
    apiKey:      '',
    sorting:     'random',
    order:       'desc',
    minRes:      '',
    categories:  '010',   
    purity:      '100',   
    query:       '',
  },
  waifupics: {
    purity:         'sfw',
    sfwCategories:  ['waifu','neko','shinobu','megumin','cuddle','awoo','pat','hug','kiss'],
    nsfwCategories: ['waifu','neko','trap','blowjob'],
  },
  nekosbest: {
    categories: ['neko','kitsune','waifu','husbando'],
  },
  display: {
    columns: 'auto',
  },
};

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return deepMerge(DEFAULT_SETTINGS, raw);
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const k of Object.keys(override)) {
    if (override[k] !== null && typeof override[k] === 'object' && !Array.isArray(override[k])) {
      out[k] = deepMerge(base[k] ?? {}, override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,         
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d11',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,          
    icon: path.join(__dirname, 'renderer', 'icon.png'),
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Origin'] = '';
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
      },
    });
  });
}

app.whenReady().then(() => {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize());
ipcMain.on('win-maximize', () => {
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win-close', () => win.close());

// ── Download ─────────────────────────────────────────────────────────────────
ipcMain.handle('download-image', async (_event, url) => {
  return new Promise((resolve, reject) => {
    const ext  = (url.split('.').pop().split('?')[0] || 'jpg').slice(0, 5);
    const dest = path.join(os.homedir(), 'Pictures', `aniwall_${Date.now()}.${ext}`);

    const dir = path.join(os.homedir(), 'Pictures');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;

    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirProto = res.headers.location.startsWith('https') ? https : http;
        redirProto.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
          r2.pipe(file);
          file.on('finish', () => { file.close(); resolve(dest); });
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });
    req.on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
});

ipcMain.handle('download-temp-image', async (_event, url) => {
  return new Promise((resolve, reject) => {
    const ext  = (url.split('.').pop().split('?')[0] || 'jpg').slice(0, 5);
    const dest = path.join(os.tmpdir(), `aniwall_temp_${Date.now()}.${ext}`);
    const file = fs.createWriteStream(dest);
    const proto = url.startsWith('https') ? https : http;

    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirProto = res.headers.location.startsWith('https') ? https : http;
        redirProto.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
          r2.pipe(file);
          file.on('finish', () => { file.close(); resolve(dest); });
        }).on('error', reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });
    req.on('error', err => { fs.unlink(dest, () => {}); reject(err); });
  });
});

ipcMain.handle('reveal-file', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── Settings & Favorites IPC ──────────────────────────────────────────────────
ipcMain.handle('get-settings', ()           => loadSettings());
ipcMain.handle('set-settings', (_e, data)   => { saveSettings(data); return true; });
ipcMain.handle('get-favorites', ()          => {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'favorites.json'), 'utf8')); } 
  catch { return []; }
});
ipcMain.handle('save-favorites', (_e, data) => { 
  fs.writeFileSync(path.join(app.getPath('userData'), 'favorites.json'), JSON.stringify(data, null, 2), 'utf8'); 
  return true; 
});

// ── IDesktopWallpaper C# interface definition ─────────────────────────────────
const WP_CS = [
  'using System; using System.Runtime.InteropServices;',
  '[ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
  'public interface IDesktopWallpaper {',
  '  void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string m, [MarshalAs(UnmanagedType.LPWStr)] string w);',
  '  [return: MarshalAs(UnmanagedType.LPWStr)] string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string m);',
  '  [return: MarshalAs(UnmanagedType.LPWStr)] string GetMonitorDevicePathAt(uint i);',
  '  [return: MarshalAs(UnmanagedType.U4)] uint GetMonitorDevicePathCount();',
  '  void GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string m, out RECT r);',
  '  void SetBackgroundColor(uint c);',
  '  [return: MarshalAs(UnmanagedType.U4)] uint GetBackgroundColor();',
  '  void SetPosition(int p);',
  '  [return: MarshalAs(UnmanagedType.I4)] int GetPosition();',
  '}',
  '[StructLayout(LayoutKind.Sequential)] public struct RECT { public int l,t,r,b; }',
  
  'public class WPHelper {',
  '  private static IDesktopWallpaper GetWP() {',
  '    Type t = Type.GetTypeFromCLSID(new Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD"));',
  '    return (IDesktopWallpaper)Activator.CreateInstance(t);', // NO MORE TYPOS!
  '  }',
  '  public static void SetWallpaper(string m, string w) { GetWP().SetWallpaper(m, w); }',
  '  public static void SetPosition(int p) { GetWP().SetPosition(p); }',
  '  public static uint GetMonitorCount() { return GetWP().GetMonitorDevicePathCount(); }',
  '  public static string GetMonInfo(uint i) {',
  '    try {',
  '      IDesktopWallpaper wp = GetWP();',
  '      string id = wp.GetMonitorDevicePathAt(i);',
  '      RECT r; wp.GetMonitorRECT(id, out r);',
  '      return i + "|" + id + "|" + Math.Abs(r.r - r.l) + "|" + Math.Abs(r.b - r.t);',
  '    } catch { return i + "|error|1920|1080"; }',
  '  }',
  '}'
].join('\n');

function encodePS(lines) {
  const script = lines.join('\n');
  return Buffer.from(script, 'utf16le').toString('base64');
}

function addTypePS() {
  return `Add-Type -TypeDefinition @"\n${WP_CS}\n"@ -ErrorAction Stop`;
}

// ── Monitor list (Windows IDesktopWallpaper COM) ──────────────────────────────
ipcMain.handle('get-monitors', async () => {
  const encoded = encodePS([
    addTypePS(),
    `try {`,
    `  $n = [WPHelper]::GetMonitorCount()`,
    `  for ($i=0; $i -lt $n; $i++) { Write-Output ([WPHelper]::GetMonInfo($i)) }`,
    `} catch {`,
    `  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue`,
    `  $sc = [System.Windows.Forms.Screen]::AllScreens`,
    `  for ($i=0; $i -lt $sc.Count; $i++) { Write-Output "$i|SCREEN:$($sc[$i].DeviceName)|$($sc[$i].Bounds.Width)|$($sc[$i].Bounds.Height)" }`,
    `}`,
  ]);
  
  return new Promise(resolve => {
    execFile('powershell.exe', ['-STA', '-NoProfile', '-EncodedCommand', encoded], (err, stdout) => {
      const base = [{ id: 'all', label: 'All Monitors', ratio: 16/9 }];
      if (err || !stdout.trim()) return resolve(base);
      const monitors = stdout.trim().split(/\r?\n/).map(line => {
        const parts = line.trim().split('|');
        if (parts.length < 2 || parts[1] === 'error') return null;
        const idx = parseInt(parts[0], 10);
        const id  = parts[1].trim();
        const w   = parseInt(parts[2], 10) || 1920;
        const h   = parseInt(parts[3], 10) || 1080;
        return id ? { id, label: `Monitor ${idx + 1} (${w}x${h})`, ratio: w / h } : null;
      }).filter(Boolean);
      resolve(monitors.length ? [...base, ...monitors] : base);
    });
  });
});

// ── Save cropped image data ───────────────────────────────────────────────────
ipcMain.handle('save-image-data', async (_e, { dataUrl, ext }) => {
  const base64 = dataUrl.split(',')[1];
  const buf    = Buffer.from(base64, 'base64');
  const dest   = path.join(os.tmpdir(), `aniwall_crop_${Date.now()}.${ext || 'jpg'}`);
  fs.writeFileSync(dest, buf);
  return dest;
});

// ── Set wallpaper (Windows IDesktopWallpaper COM) ─────────────────────────────
ipcMain.handle('set-wallpaper', async (_e, { imagePath, monitor, fitMode }) => {
  const psPath    = imagePath.replace(/"/g, '`"');
  const monitorPS = monitor === 'all' ? '$null' : `"${monitor.replace(/"/g, '`"')}"`;
  const fit       = parseInt(fitMode, 10);

  const encoded = encodePS([
    addTypePS(),
    `[WPHelper]::SetPosition(${fit})`,
    `[WPHelper]::SetWallpaper(${monitorPS}, "${psPath}")`,
  ]);

  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-STA', '-NoProfile', '-EncodedCommand', encoded], (err, _out, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(true);
    });
  });
});