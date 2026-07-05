// Kloppy's folder watcher (main process only).
// Strictly opt-in: only watches folders the user picked via the OS dialog.
// It never reads file contents — only file names and event types.
// Watched folder paths persist in watched.json in the userData directory.

const fs = require('fs');
const path = require('path');

let watchedFile = null;
let onEvent = null;           // set by main.js; receives { dir, file, type, at }
const watchers = new Map();   // dir -> fs.FSWatcher

function init(userDataDir, eventCallback) {
  watchedFile = path.join(userDataDir, 'watched.json');
  onEvent = eventCallback;
  // Resume watching folders from the previous session.
  for (const dir of load()) {
    startWatching(dir);
  }
}

function load() {
  try {
    const folders = JSON.parse(fs.readFileSync(watchedFile, 'utf8'));
    return Array.isArray(folders) ? folders.filter((f) => typeof f === 'string') : [];
  } catch {
    return [];
  }
}

function save(folders) {
  fs.writeFileSync(watchedFile, JSON.stringify(folders, null, 2));
}

function startWatching(dir) {
  if (watchers.has(dir)) return false;

  let watcher;
  try {
    // Not recursive: only the top level of the chosen folder.
    watcher = fs.watch(dir, (eventType, filename) => {
      const file = filename || '(unknown)';
      // fs.watch only says "rename" or "change"; whether the file still
      // exists tells us if a rename was an add or a delete.
      let type = 'changed';
      if (eventType === 'rename') {
        type = fs.existsSync(path.join(dir, file)) ? 'added' : 'deleted';
      }
      if (onEvent) {
        onEvent({ dir, file, type, at: new Date().toISOString() });
      }
    });
  } catch {
    return false; // folder disappeared or is unreadable
  }

  // If the folder itself vanishes, stop watching instead of crashing.
  watcher.on('error', () => stopWatching(dir));
  watchers.set(dir, watcher);
  return true;
}

function stopWatching(dir) {
  const watcher = watchers.get(dir);
  if (watcher) {
    watcher.close();
    watchers.delete(dir);
  }
}

function list() {
  return { ok: true, folders: load() };
}

function add(dir) {
  if (typeof dir !== 'string' || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { ok: false, error: 'not-a-folder' };
  }
  const folders = load();
  if (folders.includes(dir)) {
    return { ok: false, error: 'already-watched' };
  }
  startWatching(dir);
  folders.push(dir);
  save(folders);
  return { ok: true, folders };
}

function remove(dir) {
  stopWatching(dir);
  const folders = load();
  const remaining = folders.filter((d) => d !== dir);
  if (remaining.length === folders.length) {
    return { ok: false, error: 'not-found' };
  }
  save(remaining);
  return { ok: true, folders: remaining };
}

// Called when the app quits, so no watcher outlives its window.
function closeAll() {
  for (const dir of [...watchers.keys()]) {
    stopWatching(dir);
  }
}

module.exports = { init, list, add, remove, closeAll };
