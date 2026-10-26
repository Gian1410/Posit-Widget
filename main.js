const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const positWindows = new Set();
let mainWindow = null;
let nextWindowId = 1;

function getWindowFromEvent(event) {
  return BrowserWindow.fromWebContents(event.sender) || mainWindow;
}

async function writeNoteFile(filePath, payload = {}) {
  const normalizedPath = filePath.toLowerCase().endsWith('.txt') ? filePath : `${filePath}.txt`;
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '');
  const contents = `${title ? `${title}\n\n` : ''}${body}`;
  await fs.writeFile(normalizedPath, contents, 'utf8');
  return normalizedPath;
}

function createWindow({ newNote = false } = {}) {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 380;
  const height = 470;
  const offset = (positWindows.size % 5) * 26;
  const x = Math.max(workArea.x + workArea.width - width - 28 - offset, workArea.x);
  const y = Math.max(workArea.y + 28 + offset, workArea.y);
  const windowId = newNote ? `new-${Date.now()}-${nextWindowId++}` : 'default';
  const windowPath = path.join(__dirname, 'assets', 'posit-icon.ico');

  const positWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 320,
    minHeight: 360,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: windowPath,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  positWindows.add(positWindow);
  if (!mainWindow) mainWindow = positWindow;

  positWindow.loadFile(path.join(__dirname, 'index.html'), { hash: windowId });
  positWindow.setAlwaysOnTop(true, 'floating');

  positWindow.once('ready-to-show', () => {
    positWindow.show();
  });

  positWindow.on('closed', () => {
    positWindows.delete(positWindow);
    if (mainWindow === positWindow) {
      mainWindow = positWindows.values().next().value || null;
    }
  });

  return positWindow;
}

app.whenReady().then(() => createWindow());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('window:minimize', (event) => {
  getWindowFromEvent(event)?.minimize();
});

ipcMain.handle('window:close', (event) => {
  getWindowFromEvent(event)?.close();
});

ipcMain.handle('window:create-new-posit', () => {
  createWindow({ newNote: true });
  return true;
});

ipcMain.handle('window:set-always-on-top', (event, value) => {
  const positWindow = getWindowFromEvent(event);
  if (!positWindow) return false;
  positWindow.setAlwaysOnTop(Boolean(value), 'floating');
  return positWindow.isAlwaysOnTop();
});

ipcMain.handle('window:get-always-on-top', (event) => {
  return Boolean(getWindowFromEvent(event)?.isAlwaysOnTop());
});

ipcMain.handle('window:get-bounds', (event) => {
  return getWindowFromEvent(event)?.getBounds() || null;
});

ipcMain.handle('window:set-bounds', (event, bounds = {}) => {
  const positWindow = getWindowFromEvent(event);
  if (!positWindow) return null;

  const current = positWindow.getBounds();
  const next = {
    x: Number.isFinite(bounds.x) ? Math.round(bounds.x) : current.x,
    y: Number.isFinite(bounds.y) ? Math.round(bounds.y) : current.y,
    width: Math.max(320, Number.isFinite(bounds.width) ? Math.round(bounds.width) : current.width),
    height: Math.max(360, Number.isFinite(bounds.height) ? Math.round(bounds.height) : current.height)
  };

  positWindow.setBounds(next);
  return positWindow.getBounds();
});

ipcMain.handle('note:save-to-file', async (event, payload = {}) => {
  const positWindow = getWindowFromEvent(event);
  if (!positWindow) return { canceled: true };

  const safeTitle = String(payload.title || 'Mi nota')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim()
    .slice(0, 60) || 'Mi nota';

  const result = await dialog.showSaveDialog(positWindow, {
    title: 'Guardar nota Posit',
    defaultPath: path.join(app.getPath('documents'), `${safeTitle}.txt`),
    filters: [{ name: 'Archivo de texto', extensions: ['txt'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  const filePath = result.filePath.toLowerCase().endsWith('.txt')
    ? result.filePath
    : `${result.filePath}.txt`;
  const savedPath = await writeNoteFile(filePath, payload);
  return {
    canceled: false,
    filePath: savedPath,
    fileName: path.basename(savedPath)
  };
});

ipcMain.handle('note:write-to-path', async (_event, payload = {}) => {
  if (!payload.filePath) return { canceled: true };
  const savedPath = await writeNoteFile(String(payload.filePath), payload);
  return { canceled: false, filePath: savedPath, fileName: path.basename(savedPath) };
});

ipcMain.handle('note:open-from-file', async (event) => {
  const positWindow = getWindowFromEvent(event);
  if (!positWindow) return { canceled: true };

  const result = await dialog.showOpenDialog(positWindow, {
    title: 'Abrir nota de texto',
    properties: ['openFile'],
    filters: [{ name: 'Archivos de texto', extensions: ['txt'] }]
  });

  if (result.canceled || !result.filePaths[0]) return { canceled: true };

  const filePath = result.filePaths[0];
  const contents = await fs.readFile(filePath, 'utf8');
  const cleanContents = contents.replace(/^\uFEFF/, '');
  const lines = cleanContents.split(/\r?\n/);
  const hasPositTitle = lines.length > 1 && lines[1].trim() === '';
  const title = hasPositTitle ? lines[0].trim() : '';
  const body = hasPositTitle ? lines.slice(2).join('\n') : cleanContents;

  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    title,
    body
  };
});
