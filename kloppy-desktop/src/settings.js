// Kloppy's settings storage (main process only).
// Settings live in settings.json inside Electron's userData directory.

const path = require('path');
const storage = require('./storage');
const {
  DEFAULT_PERSONALITY_MODE,
  isPersonalityMode,
} = require('./personality');

const DEFAULTS = {
  launchMinimized: false,        // honored at startup in main.js (window starts hidden in the tray)
  randomCommentary: true,
  commentaryFrequency: 'medium', // low | medium | cursed
  theme: 'dark',                 // light | dark
  personalityMode: DEFAULT_PERSONALITY_MODE,
  modelPath: '',                 // path to a llamafile executable ('' = no local model)
  userName: '',                  // optional local profile name for chat memory
};

const MAX_PATH_LENGTH = 4096;
const MAX_NAME_LENGTH = 80;

const FREQUENCIES = ['low', 'medium', 'cursed'];
const THEMES = ['light', 'dark'];

let store = null;

// Called once at startup with app.getPath('userData').
function init(userDataDir) {
  store = storage.createStore(path.join(userDataDir, 'settings.json'), {
    label: 'settings',
    validate: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  });
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeLoaded(raw) {
  if (!raw) return { settings: { ...DEFAULTS }, migrated: false };

  const settings = { ...DEFAULTS, ...raw };
  let migrated = false;

  if (typeof settings.launchMinimized !== 'boolean') {
    settings.launchMinimized = DEFAULTS.launchMinimized;
    migrated = hasOwn(raw, 'launchMinimized') || migrated;
  }
  if (typeof settings.randomCommentary !== 'boolean') {
    settings.randomCommentary = DEFAULTS.randomCommentary;
    migrated = hasOwn(raw, 'randomCommentary') || migrated;
  }
  if (!FREQUENCIES.includes(settings.commentaryFrequency)) {
    settings.commentaryFrequency = DEFAULTS.commentaryFrequency;
    migrated = hasOwn(raw, 'commentaryFrequency') || migrated;
  }
  if (!THEMES.includes(settings.theme)) {
    settings.theme = DEFAULTS.theme;
    migrated = hasOwn(raw, 'theme') || migrated;
  }
  if (!isPersonalityMode(settings.personalityMode)) {
    settings.personalityMode = DEFAULTS.personalityMode;
    migrated = hasOwn(raw, 'personalityMode') || migrated;
  }
  if (typeof settings.modelPath !== 'string' || settings.modelPath.length > MAX_PATH_LENGTH) {
    settings.modelPath = DEFAULTS.modelPath;
    migrated = hasOwn(raw, 'modelPath') || migrated;
  }
  if (typeof settings.userName !== 'string' || settings.userName.length > MAX_NAME_LENGTH) {
    settings.userName = DEFAULTS.userName;
    migrated = hasOwn(raw, 'userName') || migrated;
  }

  return { settings, migrated };
}

function load() {
  // Unknown or missing keys fall back to defaults.
  const { settings, migrated } = normalizeLoaded(store.load());
  if (migrated) save(settings);
  return settings;
}

function save(settings) {
  store.save(settings);
}

function get() {
  return { ok: true, settings: load() };
}

// Accepts a partial update; validates each key it knows about.
function update(partial) {
  if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
    return { ok: false, error: 'invalid' };
  }

  const settings = load();

  if ('launchMinimized' in partial) {
    if (typeof partial.launchMinimized !== 'boolean') return { ok: false, error: 'invalid' };
    settings.launchMinimized = partial.launchMinimized;
  }
  if ('randomCommentary' in partial) {
    if (typeof partial.randomCommentary !== 'boolean') return { ok: false, error: 'invalid' };
    settings.randomCommentary = partial.randomCommentary;
  }
  if ('commentaryFrequency' in partial) {
    if (!FREQUENCIES.includes(partial.commentaryFrequency)) return { ok: false, error: 'invalid' };
    settings.commentaryFrequency = partial.commentaryFrequency;
  }
  if ('theme' in partial) {
    if (!THEMES.includes(partial.theme)) return { ok: false, error: 'invalid' };
    settings.theme = partial.theme;
  }
  if ('personalityMode' in partial) {
    if (!isPersonalityMode(partial.personalityMode)) return { ok: false, error: 'invalid' };
    settings.personalityMode = partial.personalityMode;
  }
  if ('modelPath' in partial) {
    if (typeof partial.modelPath !== 'string' || partial.modelPath.length > MAX_PATH_LENGTH) {
      return { ok: false, error: 'invalid' };
    }
    settings.modelPath = partial.modelPath.trim();
  }
  if ('userName' in partial) {
    if (typeof partial.userName !== 'string' || partial.userName.length > MAX_NAME_LENGTH) {
      return { ok: false, error: 'invalid' };
    }
    settings.userName = partial.userName.trim();
  }

  save(settings);
  return { ok: true, settings };
}

module.exports = { init, get, update };
