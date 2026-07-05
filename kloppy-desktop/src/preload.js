// Kloppy preload script.
// The renderer has no Node access (contextIsolation on, nodeIntegration off),
// so this bridge exposes exactly the few calls Kloppy needs — nothing more.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kloppy', {
  version: '0.0.1',
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    add: (text) => ipcRenderer.invoke('notes:add', text),
    remove: (id) => ipcRenderer.invoke('notes:delete', id),
  },
  reminders: {
    list: () => ipcRenderer.invoke('reminders:list'),
    add: (text, dueAt) => ipcRenderer.invoke('reminders:add', text, dueAt),
    complete: (id) => ipcRenderer.invoke('reminders:complete', id),
    remove: (id) => ipcRenderer.invoke('reminders:delete', id),
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
  watcher: {
    list: () => ipcRenderer.invoke('watcher:list'),
    choose: () => ipcRenderer.invoke('watcher:choose'),
    remove: (dir) => ipcRenderer.invoke('watcher:remove', dir),
    onEvent: (callback) => ipcRenderer.on('watcher:event', (_event, evt) => callback(evt)),
  },
  // Main-process events the renderer reacts to (tray menu items).
  onCursed: (callback) => ipcRenderer.on('kloppy:cursed', () => callback()),
  // Summon popup: ask main to spawn/reuse the popup, and receive its message.
  summon: () => ipcRenderer.invoke('popup:summon'),
  onPopupMessage: (callback) => ipcRenderer.on('popup:message', (_event, text) => callback(text)),
});
