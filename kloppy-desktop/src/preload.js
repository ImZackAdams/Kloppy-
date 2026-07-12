// Kloppy preload script.
// The renderer has no Node access (contextIsolation on, nodeIntegration off),
// so this bridge exposes exactly the few calls Kloppy needs — nothing more.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kloppy', {
  // Live app version from the main process (app.getVersion()), for the About panel.
  getVersion: () => ipcRenderer.invoke('app:version'),
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    add: (text) => ipcRenderer.invoke('notes:add', text),
    remove: (id) => ipcRenderer.invoke('notes:delete', id),
  },
  memories: {
    list: () => ipcRenderer.invoke('memories:list'),
    add: (text) => ipcRenderer.invoke('memories:add', text),
    update: (id, text) => ipcRenderer.invoke('memories:update', id, text),
    delete: (id) => ipcRenderer.invoke('memories:delete', id),
    setEnabled: (id, enabled) => ipcRenderer.invoke('memories:setEnabled', id, enabled),
    deleteAll: () => ipcRenderer.invoke('memories:deleteAll'),
  },
  chats: {
    list: () => ipcRenderer.invoke('chats:list'),
    getActive: () => ipcRenderer.invoke('chats:getActive'),
    create: () => ipcRenderer.invoke('chats:create'),
    switch: (id) => ipcRenderer.invoke('chats:switch', id),
    rename: (id, title) => ipcRenderer.invoke('chats:rename', id, title),
    delete: (id) => ipcRenderer.invoke('chats:delete', id),
    deleteAll: () => ipcRenderer.invoke('chats:deleteAll'),
    clearCurrent: () => ipcRenderer.invoke('chats:clearCurrent'),
    appendMessage: (role, content) => ipcRenderer.invoke('chats:appendMessage', role, content),
  },
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    add: (text, dueAt) => ipcRenderer.invoke('reminders:add', text, dueAt),
    complete: (id) => ipcRenderer.invoke('reminders:complete', id),
    remove: (id) => ipcRenderer.invoke('reminders:delete', id),
    // Fired when the user clicks an OS reminder notification.
    onOpenPanel: (callback) => ipcRenderer.on('reminders:open-panel', () => callback()),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial),
  },
  actions: {
    list: () => ipcRenderer.invoke('actions:list'),
    add: (name, description, command) => ipcRenderer.invoke('actions:add', name, description, command),
    remove: (id) => ipcRenderer.invoke('actions:delete', id),
  },
  llm: {
    status: () => ipcRenderer.invoke('llm:status'),
    ask: (prompt, history, requestId) => ipcRenderer.invoke('llm:ask', prompt, history, requestId),
    setupInfo: () => ipcRenderer.invoke('llm:setup-info'),
    downloadDefault: () => ipcRenderer.invoke('llm:download-default'),
    cancelDownload: () => ipcRenderer.invoke('llm:cancel-download'),
    onStatus: (callback) => ipcRenderer.on('llm:status', (_event, status) => callback(status)),
    // Streamed reply tokens: { id, delta } pairs for an in-flight ask.
    onChunk: (callback) => ipcRenderer.on('llm:chunk', (_event, chunk) => callback(chunk)),
  },
  watcher: {
    list: () => ipcRenderer.invoke('watcher:list'),
    choose: () => ipcRenderer.invoke('watcher:choose'),
    remove: (dir) => ipcRenderer.invoke('watcher:remove', dir),
    onEvent: (callback) => ipcRenderer.on('watcher:event', (_event, evt) => callback(evt)),
  },
  // Main-process events the renderer reacts to (tray menu items).
  onCursed: (callback) => ipcRenderer.on('kloppy:cursed', () => callback()),
  // One-time storage recovery warnings (corrupted file restored or reset).
  onStorageWarning: (callback) => ipcRenderer.on('storage:warning', (_event, text) => callback(text)),
  // Summon popup: ask main to spawn/reuse the popup, and receive its message.
  summon: () => ipcRenderer.invoke('popup:summon'),
  onPopupMessage: (callback) => ipcRenderer.on('popup:message', (_event, text) => callback(text)),
});
