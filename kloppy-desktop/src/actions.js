// Kloppy's saved actions (main process only) — STORAGE ONLY, NO EXECUTION.
//
// Actions are user-defined placeholders for future automation. The "command"
// field is inert text; nothing in this app runs it, spawns processes, or
// touches a shell.
//
// TODO(future safe execution) — before any action ever runs, this needs:
//   - allowlisted commands only (no arbitrary shell strings)
//   - an explicit confirmation prompt per run, in the UI
//   - a visible log of what ran, when, and with what result
//   - no environment/secret exposure to executed commands
//   - no silent background execution, ever
// Until all of that exists, "Run" stays a joke button on purpose.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_NAME = 60;
const MAX_TEXT = 300;

let actionsFile = null;

function init(userDataDir) {
  actionsFile = path.join(userDataDir, 'actions.json');
}

function load() {
  try {
    const actions = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));
    return Array.isArray(actions) ? actions : [];
  } catch {
    return [];
  }
}

function save(actions) {
  fs.writeFileSync(actionsFile, JSON.stringify(actions, null, 2));
}

function list() {
  return { ok: true, actions: load() };
}

function add(name, description, command) {
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'no-name' };
  }
  if (name.trim().length > MAX_NAME) {
    return { ok: false, error: 'too-long', max: MAX_NAME };
  }
  if (typeof description !== 'string' || typeof command !== 'string'
      || description.length > MAX_TEXT || command.length > MAX_TEXT) {
    return { ok: false, error: 'too-long', max: MAX_TEXT };
  }

  const action = {
    id: crypto.randomUUID(),
    name: name.trim(),
    description: description.trim(),
    command: command.trim(),   // stored as inert text, never executed
    createdAt: new Date().toISOString(),
  };

  const actions = load();
  actions.unshift(action);
  save(actions);
  return { ok: true, action };
}

function remove(id) {
  const actions = load();
  const remaining = actions.filter((a) => a.id !== id);
  if (remaining.length === actions.length) {
    return { ok: false, error: 'not-found' };
  }
  save(remaining);
  return { ok: true };
}

module.exports = { init, list, add, remove };
