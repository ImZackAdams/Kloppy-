// Kloppy's settings storage (main process only).
// Settings live in settings.json inside Electron's userData directory.

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  launchMinimized: false,        // stored now, wired up in a future version
  randomCommentary: true,
  commentaryFrequency: 'medium', // low | medium | cursed
  theme: 'midnight',             // midnight | beige | toxic
};

const FREQUENCIES = ['low', 'medium', 'cursed'];
const THEMES = ['midnight', 'beige', 'toxic'];

let settingsFile = null;

// Called once at startup with app.getPath('userData').
function init(userDataDir) {
  settingsFile = path.join(userDataDir, 'settings.json');
}

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    // Unknown or missing keys fall back to defaults.
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function get() {
  return { ok: true, settings: load() };
}

// Accepts a partial update; validates each key it knows about.
function update(partial) {
  if (typeof partial !== 'object' || partial === null) {
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

  save(settings);
  return { ok: true, settings };
}

module.exports = { init, get, update };
