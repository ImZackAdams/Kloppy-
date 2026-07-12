// Kloppy main process.
// Creates the app window and system tray, and handles cross-platform lifecycle.

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  screen,
  dialog,
  Notification,
} = require('electron');
const path = require('path');
const notes = require('./notes');
const chats = require('./chats');
const memories = require('./memories');
const reminders = require('./reminders');
const settings = require('./settings');
const watcher = require('./watcher');
const actions = require('./actions');
const storage = require('./storage');
const llm = require('./llm');
const modelSetup = require('./model-setup');
const { createTrayIcon } = require('./tray-icon');

// Test/dev hook: an isolated userData directory keeps verification runs —
// their settings, model cache, and single-instance lock — away from the
// real profile. Must be set before the lock is requested below.
if (process.env.KLOPPY_USER_DATA_DIR) {
  app.setPath('userData', process.env.KLOPPY_USER_DATA_DIR);
}

// Keep module-level references: if the window or tray object gets
// garbage-collected, it silently disappears from the screen.
let mainWindow = null;
let tray = null;

// Distinguishes "user closed the window" (hide to tray) from "really quit".
// Set by the before-quit event, which fires for Quit in the tray menu,
// Cmd+Q, and platform shutdown.
let isQuitting = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function createWindow(options = {}) {
  const { launchMinimized = false } = options;
  mainWindow = new BrowserWindow({
    width: 640,
    height: 720,
    minWidth: 360,
    minHeight: 420,
    show: !launchMinimized,
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

  // Storage corruption warnings can fire before the window exists (they queue
  // in storage.js); deliver them — and any later ones — once the renderer is
  // ready to show them.
  mainWindow.webContents.on('did-finish-load', () => {
    storage.onWarning((message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('storage:warning', message);
      }
    });
  });

  // Closing the window hides Kloppy to the tray instead of quitting.
  // He is still there. He is always there.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// ---- Due-reminder scheduler ----
// OS notifications fire from the main process, so reminders are announced
// even while the window hides in the tray. Notified state persists in
// reminders.json (notifiedAt), so each due occurrence notifies exactly once
// across restarts.

const REMINDER_CHECK_MS = 30 * 1000;

function notifyReminder(reminder) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: 'Kloppy reminder',
    body: reminder.text,
  });
  notification.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('reminders:open-panel');
  });
  notification.show();
}

function checkDueReminders() {
  for (const reminder of reminders.dueForNotification()) {
    // Mark first: a lost notification beats a duplicate one.
    reminders.markNotified(reminder.id);
    notifyReminder(reminder);
  }
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

// Release menu: keep dev affordances (Reload / Toggle DevTools) out of the
// packaged app. In development we leave Electron's default menu in place so
// DevTools stays reachable.
function setupApplicationMenu() {
  if (!app.isPackaged) return; // dev: keep the default menu for debugging

  if (process.platform === 'darwin') {
    // macOS always shows a menu bar, so ship a minimal one: the standard app
    // menu plus a roles-based Edit menu so clipboard shortcuts keep working.
    // No View menu (no Reload / Toggle DevTools) in packaged builds.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]));
  } else {
    // Windows/Linux: no menu bar at all in the shipped app.
    Menu.setApplicationMenu(null);
  }
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  setupApplicationMenu();

  // Storage lives next to the app's other user data.
  const userDataDir = app.getPath('userData');
  notes.init(userDataDir);
  chats.init(userDataDir);
  memories.init(userDataDir);
  reminders.init(userDataDir);
  settings.init(userDataDir);
  actions.init(userDataDir);
  modelSetup.init({
    userDataDir,
    getModelPath: () => settings.get().settings.modelPath,
    saveModelPath: (modelPath) => settings.update({ modelPath }),
    onStatusChanged: () => llm.refreshStatus(),
  });
  watcher.init(userDataDir, (event) => {
    // Forward filesystem events to the main window so Kloppy can react.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('watcher:event', event);
    }
  });

  // IPC endpoints the preload bridge is allowed to call.
  ipcMain.handle('notes:list', () => notes.list());
  ipcMain.handle('notes:add', (_event, text) => notes.add(text));
  ipcMain.handle('notes:delete', (_event, id) => notes.remove(id));

  // Destructive operations confirm through a native dialog here in the main
  // process, so the renderer can never erase local records alone.
  async function confirmDestructiveAction(confirmLabel, message, detail) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: [confirmLabel, 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Kloppy',
      message,
      detail,
    });
    return result.response === 0;
  }

  ipcMain.handle('chats:list', () => chats.list());
  ipcMain.handle('chats:getActive', () => chats.getActive());
  ipcMain.handle('chats:create', () => chats.create());
  ipcMain.handle('chats:switch', (_event, id) => chats.switchTo(id));
  ipcMain.handle('chats:rename', (_event, id, title) => chats.rename(id, title));
  ipcMain.handle('chats:delete', async (_event, id) => {
    const target = chats.list().chats.find((c) => c.id === id);
    if (!target) return { ok: false, error: 'not-found' };
    const confirmed = await confirmDestructiveAction('Delete',
      `Delete the chat "${target.title}"?`,
      'Its messages are erased from this computer. There is no undo.');
    if (!confirmed) return { ok: false, error: 'canceled' };
    return chats.remove(id);
  });
  ipcMain.handle('chats:deleteAll', async () => {
    const confirmed = await confirmDestructiveAction('Delete all',
      'Delete ALL chat history?',
      'Every chat is erased from this computer. There is no undo.');
    if (!confirmed) return { ok: false, error: 'canceled' };
    return chats.removeAll();
  });
  ipcMain.handle('chats:clearCurrent', async () => {
    const confirmed = await confirmDestructiveAction('Clear',
      'Clear the current chat?',
      'Its messages are erased from this computer. There is no undo.');
    if (!confirmed) return { ok: false, error: 'canceled' };
    return chats.clearActive();
  });
  ipcMain.handle('chats:appendMessage', (_event, role, content) =>
    chats.appendMessage(role, content));

  ipcMain.handle('memories:list', () => memories.list());
  ipcMain.handle('memories:add', (_event, text) => memories.add(text));
  ipcMain.handle('memories:update', (_event, id, text) => memories.update(id, text));
  ipcMain.handle('memories:setEnabled', (_event, id, enabled) =>
    memories.setEnabled(id, enabled));
  ipcMain.handle('memories:delete', async (_event, id) => {
    const target = memories.list().memories.find((memory) => memory.id === id);
    if (!target) return { ok: false, error: 'not-found' };
    const preview = target.text.length > 80 ? `${target.text.slice(0, 77)}...` : target.text;
    const confirmed = await confirmDestructiveAction('Delete',
      'Delete this memory?',
      `"${preview}" will be erased from this computer. There is no undo.`);
    if (!confirmed) return { ok: false, error: 'canceled' };
    return memories.remove(id);
  });
  ipcMain.handle('memories:deleteAll', async () => {
    const confirmed = await confirmDestructiveAction('Delete all',
      'Delete ALL memories?',
      'Every memory is erased from this computer. There is no undo.');
    if (!confirmed) return { ok: false, error: 'canceled' };
    return memories.removeAll();
  });

  ipcMain.handle('reminders:list', () => reminders.list());
  ipcMain.handle('reminders:add', (_event, text, dueAt) => reminders.add(text, dueAt));
  ipcMain.handle('reminders:complete', (_event, id) => {
    // The renderer auto-completes reminders the moment its own poll sees
    // them come due; sweep first so that occurrence still notifies once.
    checkDueReminders();
    return reminders.complete(id);
  });
  ipcMain.handle('reminders:delete', (_event, id) => reminders.remove(id));

  ipcMain.handle('popup:summon', () => {
    summonKloppy();
    return { ok: true };
  });

  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', async (_event, partial) => {
    const previousModelPath = settings.get().settings.modelPath;
    const result = settings.update(partial);
    // The model path may have appeared/vanished; keep the LLM status honest.
    if (result.ok) {
      if (Object.prototype.hasOwnProperty.call(partial, 'modelPath')) {
        modelSetup.clearFailure();
        if (previousModelPath !== result.settings.modelPath) {
          await llm.stop();
        }
      }
      llm.refreshStatus();
    }
    return result;
  });

  // Local LLM chat. The llamafile server starts lazily inside ask().
  llm.init({
    getModelPath: () => settings.get().settings.modelPath,
    getPersonalityMode: () => settings.get().settings.personalityMode,
    getSetupStatus: () => modelSetup.getStatusForLlm(),
    getLlamafileHomeDir: () => path.join(userDataDir, 'llamafile-runtime'),
    getAssistantContext: () => ({
      profile: {
        userName: settings.get().settings.userName,
      },
      notes: notes.list().notes,
      memories: memories.enabled().memories,
      reminders: reminders.list().reminders,
      watchedFolders: watcher.list().folders,
      actions: actions.list().actions,
    }),
    localActions: {
      addNote: (text) => notes.add(text),
      addReminder: (text, dueAt) => reminders.add(text, dueAt),
      setUserName: (userName) => settings.update({ userName }),
    },
    broadcast: (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('llm:status', status);
      }
    },
  });
  ipcMain.handle('llm:status', () => llm.getStatus());
  ipcMain.handle('llm:ask', (event, prompt, history, requestId) => {
    // The renderer picks the request id so it can match chunks to the ask;
    // it is only ever echoed back to the same window. Validate shape anyway.
    const id = typeof requestId === 'string' && requestId.length > 0 && requestId.length <= 64
      ? requestId
      : null;
    const onToken = id
      ? (delta) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('llm:chunk', { id, delta });
        }
      }
      : null;
    return llm.ask(prompt, history, onToken);
  });
  ipcMain.handle('llm:setup-info', () => modelSetup.getInfo());
  ipcMain.handle('llm:download-default', () => modelSetup.downloadDefault());
  ipcMain.handle('llm:cancel-download', () => modelSetup.cancelDownload());

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

  // Read-only: the packaged app version, for display in the About panel.
  ipcMain.handle('app:version', () => app.getVersion());

  createWindow({ launchMinimized: settings.get().settings.launchMinimized });
  createTray();

  checkDueReminders(); // anything that came due while Kloppy was closed
  setInterval(checkDueReminders, REMINDER_CHECK_MS);

  // macOS: clicking the dock icon re-shows the hidden window.
  app.on('activate', () => {
    if (mainWindow) mainWindow.show();
  });
});

// Runs before any window starts closing during a real quit.
app.on('before-quit', () => {
  isQuitting = true;
});

// Release all filesystem watchers and kill the model server on the way out.
// llm.stop() dispatches the kill signal synchronously (with a SIGKILL
// escalation timer), so no llamafile process outlives the app.
app.on('will-quit', () => {
  modelSetup.cancelDownload();
  watcher.closeAll();
  llm.stop();
});

// With close-to-tray, this only fires during a real quit (or if the window
// is destroyed some other way). Keep the macOS stay-alive convention.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
