// Kloppy main process.
// Creates the app window and system tray, and handles cross-platform lifecycle.

const { app, BrowserWindow, Menu, Tray, ipcMain } = require('electron');
const path = require('path');
const notes = require('./notes');
const reminders = require('./reminders');
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

function createTray() {
  // The tray icon is generated in code (see tray-icon.js) — no asset files.
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Kloppy — your desktop gremlin');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Kloppy', click: () => mainWindow.show() },
    { label: 'Hide Kloppy', click: () => mainWindow.hide() },
    {
      label: 'Say something cursed',
      click: () => mainWindow.webContents.send('kloppy:cursed'),
    },
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

  // IPC endpoints the preload bridge is allowed to call.
  ipcMain.handle('notes:list', () => notes.list());
  ipcMain.handle('notes:add', (_event, text) => notes.add(text));
  ipcMain.handle('notes:delete', (_event, id) => notes.remove(id));

  ipcMain.handle('reminders:list', () => reminders.list());
  ipcMain.handle('reminders:add', (_event, text, dueAt) => reminders.add(text, dueAt));
  ipcMain.handle('reminders:complete', (_event, id) => reminders.complete(id));
  ipcMain.handle('reminders:delete', (_event, id) => reminders.remove(id));

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

// With close-to-tray, this only fires during a real quit (or if the window
// is destroyed some other way). Keep the macOS stay-alive convention.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
