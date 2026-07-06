// Kloppy's manual memory storage (main process only).
// Memories live in memories.json inside Electron's userData directory:
//   { memories: [{ id, text, enabled, createdAt, updatedAt }, ...] }

const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');

const MAX_MEMORY_LENGTH = 500;

let store = null;

function init(userDataDir) {
  store = storage.createStore(path.join(userDataDir, 'memories.json'), {
    label: 'memories',
    validate: (value) => typeof value === 'object' && value !== null
      && !Array.isArray(value) && Array.isArray(value.memories),
  });
}

function isIsoString(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function cleanText(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function isValidText(text) {
  return text !== '' && text.length <= MAX_MEMORY_LENGTH;
}

function sanitizeMemory(memory) {
  if (typeof memory !== 'object' || memory === null) return null;
  const text = cleanText(memory.text);
  if (typeof memory.id !== 'string' || !memory.id.startsWith('mem_')) return null;
  if (!isValidText(text)) return null;
  if (typeof memory.enabled !== 'boolean') return null;
  if (!isIsoString(memory.createdAt) || !isIsoString(memory.updatedAt)) return null;
  return {
    id: memory.id,
    text,
    enabled: memory.enabled,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

function load() {
  const raw = store.load() ?? { memories: [] };
  const seen = new Set();
  const memories = [];

  for (const item of Array.isArray(raw.memories) ? raw.memories : []) {
    const memory = sanitizeMemory(item);
    if (!memory || seen.has(memory.text)) continue;
    seen.add(memory.text);
    memories.push(memory);
  }

  return memories;
}

function save(memories) {
  store.save({ memories });
}

function list() {
  return { ok: true, memories: load() };
}

function enabled() {
  return { ok: true, memories: load().filter((memory) => memory.enabled) };
}

function validateText(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return { ok: false, error: 'empty' };
  if (cleaned.length > MAX_MEMORY_LENGTH) {
    return { ok: false, error: 'too-long', max: MAX_MEMORY_LENGTH };
  }
  return { ok: true, text: cleaned };
}

function add(text) {
  const valid = validateText(text);
  if (!valid.ok) return valid;

  const memories = load();
  const duplicate = memories.find((memory) => memory.text === valid.text);
  if (duplicate) return { ok: true, memory: duplicate, duplicate: true };

  const now = new Date().toISOString();
  const memory = {
    id: `mem_${crypto.randomUUID()}`,
    text: valid.text,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  memories.unshift(memory);
  save(memories);
  return { ok: true, memory };
}

function update(id, text) {
  const valid = validateText(text);
  if (!valid.ok) return valid;

  const memories = load();
  const memory = memories.find((item) => item.id === id);
  if (!memory) return { ok: false, error: 'not-found' };

  const duplicate = memories.find((item) => item.id !== id && item.text === valid.text);
  if (duplicate) {
    save(memories.filter((item) => item.id !== id));
    return { ok: true, memory: duplicate, duplicate: true };
  }

  memory.text = valid.text;
  memory.updatedAt = new Date().toISOString();
  save(memories);
  return { ok: true, memory };
}

function setEnabled(id, enabledValue) {
  if (typeof enabledValue !== 'boolean') return { ok: false, error: 'invalid' };

  const memories = load();
  const memory = memories.find((item) => item.id === id);
  if (!memory) return { ok: false, error: 'not-found' };

  memory.enabled = enabledValue;
  memory.updatedAt = new Date().toISOString();
  save(memories);
  return { ok: true, memory };
}

function remove(id) {
  const memories = load();
  const remaining = memories.filter((memory) => memory.id !== id);
  if (remaining.length === memories.length) {
    return { ok: false, error: 'not-found' };
  }
  save(remaining);
  return { ok: true };
}

function removeAll() {
  save([]);
  return { ok: true };
}

module.exports = {
  init,
  list,
  enabled,
  add,
  update,
  setEnabled,
  remove,
  removeAll,
  MAX_MEMORY_LENGTH,
};
