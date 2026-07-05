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
  // Main-process events the renderer reacts to (tray menu items).
  onCursed: (callback) => ipcRenderer.on('kloppy:cursed', () => callback()),
});
