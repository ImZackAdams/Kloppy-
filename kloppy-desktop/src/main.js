// Kloppy main process.
// Creates the app window and system tray, and handles cross-platform lifecycle.

const { app, BrowserWindow, Menu, Tray, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const notes = require('./notes');
const reminders = require('./reminders');
const settings = require('./settings');
const watcher = require('./watcher');
const actions = require('./actions');
const { createTrayIcon } = require('./tray-icon');

// Keep module-level references: if the window or tray object gets
// garbage-collected, it silently disappears from the screen.
let mainWindow = null;
let tray = null;

// Distinguishes "user closed the window" (hide to tray) from "really quit".
// Set by the before-quit event, which fires for Quit in the tray menu,
// Cmd+Q, and platform shutdown.
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640,
    height: 720,
    minWidth: 360,
    minHeight: 420,
    title: 'Kloppy',
    icon: createTrayIcon(),
    backgroundColor: '#1f7a6d',
    webPreferences: {
      // Safe defaults: the renderer has no direct access to Node.
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Closing the window hides Kloppy to the tray instead of quitting.
  // He is still there. He is always there.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ---- The summon popup: a tiny Kloppy that pops up with commentary ----

const summonLines = [
  "It looks like you're avoiding the real task.",
  'I noticed you opened settings. Bold move.',
  'Your filesystem has vibes. Bad ones.',
  'Reminder: productivity is just procrastination with branding.',
  'Please insert Disk 2.',
];

let popupWindow = null;

function summonKloppy() {
  const message = summonLines[Math.floor(Math.random() * summonLines.length)];

  // Reuse the existing popup, so summoning twice never stacks windows.
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('popup:message', message);
    popupWindow.show();
    return;
  }

  const width = 420;
  const height = 260;
  const { workArea } = screen.getPrimaryDisplay();

  popupWindow = new BrowserWindow({
    width,
    height,
    // Bottom-right corner, like a creature peeking out of the taskbar.
    x: workArea.x + workArea.width - width - 16,
    y: workArea.y + workArea.height - height - 16,
    resizable: false,
    alwaysOnTop: true,
    title: 'Kloppy!',
    icon: createTrayIcon(),
    backgroundColor: '#1f7a6d',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  popupWindow.loadFile(path.join(__dirname, 'renderer', 'popup.html'));
  popupWindow.webContents.on('did-finish-load', () => {
    popupWindow.webContents.send('popup:message', message);
  });
  popupWindow.on('closed', () => {
    popupWindow = null;
  });
}

function createTray() {
  // The tray icon is generated in code (see tray-icon.js) to match the window icon.
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Kloppy — your desktop gremlin');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Kloppy', click: () => mainWindow.show() },
    { label: 'Hide Kloppy', click: () => mainWindow.hide() },
    {
      label: 'Say something cursed',
      click: () => mainWindow.webContents.send('kloppy:cursed'),
    },
    { label: 'Summon Kloppy', click: summonKloppy },
    { type: 'separator' },
    // The only true exit. Sets isQuitting via before-quit, so the
    // window's close handler lets the app actually shut down.
    { label: 'Quit', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  // Storage lives next to the app's other user data.
  notes.init(app.getPath('userData'));
  reminders.init(app.getPath('userData'));
  settings.init(app.getPath('userData'));
  actions.init(app.getPath('userData'));
  watcher.init(app.getPath('userData'), (event) => {
    // Forward filesystem events to the main window so Kloppy can react.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watcher:event', event);
    }
  });

  // IPC endpoints the preload bridge is allowed to call.
  ipcMain.handle('notes:list', () => notes.list());
  ipcMain.handle('notes:add', (_event, text) => notes.add(text));
  ipcMain.handle('notes:delete', (_event, id) => notes.remove(id));

  ipcMain.handle('reminders:list', () => reminders.list());
  ipcMain.handle('reminders:add', (_event, text, dueAt) => reminders.add(text, dueAt));
  ipcMain.handle('reminders:complete', (_event, id) => reminders.complete(id));
  ipcMain.handle('reminders:delete', (_event, id) => reminders.remove(id));

  ipcMain.handle('popup:summon', () => {
    summonKloppy();
    return { ok: true };
  });

  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', (_event, partial) => settings.update(partial));

  ipcMain.handle('watcher:list', () => watcher.list());
  ipcMain.handle('watcher:choose', async () => {
    // The folder picker lives in the main process; the renderer never
    // gets to name arbitrary paths to watch.
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a folder for Kloppy to watch',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'canceled' };
    }
    return watcher.add(result.filePaths[0]);
  });
  ipcMain.handle('watcher:remove', (_event, dir) => watcher.remove(dir));

  // Actions are stored, listed, deleted — deliberately NO "run" channel.
  // See the safety TODO in actions.js before ever adding one.
  ipcMain.handle('actions:list', () => actions.list());
  ipcMain.handle('actions:add', (_event, name, description, command) =>
    actions.add(name, description, command));
  ipcMain.handle('actions:delete', (_event, id) => actions.remove(id));

  createWindow();
  createTray();

  // macOS: clicking the dock icon re-shows the hidden window.
  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
});

// Runs before any window starts closing during a real quit.
app.on('before-quit', () => {
  isQuitting = true;
});

// Release all filesystem watchers on the way out.
app.on('will-quit', () => {
  watcher.closeAll();
});

// With close-to-tray, this only fires during a real quit (or if the window
// is destroyed some other way). Keep the macOS stay-alive convention.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
