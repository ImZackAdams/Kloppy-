// Kloppy's local brain (main process only).
// Runs a user-supplied llamafile — a single self-contained executable that
// serves an OpenAI-compatible API — as a child process bound to 127.0.0.1,
// and asks it for chat completions. Nothing here can leave this machine:
// the only address ever contacted is localhost, on a port we picked.
//
// The subprocess starts lazily on the first ask(), not at app launch, and
// main.js calls stop() on quit so no server outlives the app.

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const STARTUP_TIMEOUT_MS = 90 * 1000; // big models take a while to load
const HEALTH_POLL_MS = 500;
const REPLY_TIMEOUT_MS = 120 * 1000;
const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_TOKENS = 500;
const MAX_CONTEXT_ITEMS = 8;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_TEXT = 800;

const SYSTEM_PROMPT =
  'You are Kloppy, a sardonic but harmless retro desktop assistant gremlin ' +
  'shaped like a paperclip. You live in the user\'s taskbar. Reply in one to ' +
  'three short sentences, deadpan and a little unhinged, but always actually ' +
  'answer the user\'s question or request first. Never use markdown. You are ' +
  'local-first and offline. If the user asks about app data, use the local ' +
  'context below instead of guessing.';

let getModelPath = null;           // injected by main.js; reads the settings file
let getSetupStatus = null;         // injected by main.js; first-run download state
let getLlamafileHomeDir = null;    // injected by main.js; keeps runtime files in userData
let getAssistantContext = null;    // injected by main.js; read-only app context
let localActions = null;           // injected by main.js; safe app mutations
let broadcast = null;              // injected by main.js; pushes status to windows

let child = null;        // running llamafile server, if any
let runningPath = null;  // model path the current child was started with
let port = null;
let startPromise = null; // shared by concurrent asks so we spawn only once
let askInFlight = false;
let stopping = false;    // suppresses the exit handler during deliberate kills
let pendingAction = null; // multi-turn local command, e.g. "Make a note" -> content next

// Internal runtime state: not-configured | idle | starting | ready | error
// ("idle" = a model path is configured but the server hasn't been needed
// yet; public llm:status maps that to setup state "ready" with a runtime
// field.) detail: machine-readable reason for error states.
let status = { state: 'not-configured', detail: '' };

function init(options) {
  getModelPath = options.getModelPath;
  getSetupStatus = options.getSetupStatus || null;
  getLlamafileHomeDir = options.getLlamafileHomeDir || null;
  getAssistantContext = options.getAssistantContext || null;
  localActions = options.localActions || null;
  broadcast = options.broadcast;
  refreshStatus();
}

function publicStatus() {
  const setupStatus = getSetupStatus ? getSetupStatus() : null;
  if (setupStatus) return setupStatus;

  if (status.state === 'not-configured') {
    return { state: 'not-configured', detail: '' };
  }
  if (status.state === 'error') {
    return { state: 'failed', detail: status.detail, runtime: 'error' };
  }
  if (status.state === 'starting') {
    return { state: 'ready', detail: '', runtime: 'starting' };
  }
  if (status.state === 'ready') {
    return { state: 'ready', detail: '', runtime: 'online' };
  }
  return { state: 'ready', detail: '', runtime: 'idle' };
}

function emitStatus() {
  if (broadcast) broadcast(publicStatus());
}

function setStatus(state, detail = '') {
  status = { state, detail };
  emitStatus();
}

// Recompute the resting status (used at init and after settings changes,
// so the renderer never shows "not configured" when a path exists).
function refreshStatus() {
  if (!(child || startPromise)) {
    status = { state: getModelPath() ? 'idle' : 'not-configured', detail: '' };
  }
  emitStatus();
}

function getStatus() {
  return { ok: true, status: publicStatus() };
}

// The OS hands out a free port; avoids "port busy" failures entirely.
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const freePort = server.address().port;
      server.close(() => resolve(freePort));
    });
  });
}

function baseUrl() {
  return `http://127.0.0.1:${port}`;
}

function childEnv() {
  const env = { ...process.env };
  if (!getLlamafileHomeDir) return env;

  const runtimeDir = getLlamafileHomeDir();
  if (!runtimeDir) return env;

  const homeDir = path.join(runtimeDir, 'home');
  const cacheDir = path.join(runtimeDir, 'cache');
  const localAppDataDir = path.join(runtimeDir, 'local-app-data');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(localAppDataDir, { recursive: true });

  env.HOME = homeDir;
  env.USERPROFILE = homeDir;
  env.XDG_CACHE_HOME = cacheDir;
  env.LOCALAPPDATA = localAppDataDir;
  return env;
}

function nowParts() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return { now, date, time, year: now.getFullYear(), iso: now.toISOString() };
}

function truncate(text, max = 140) {
  const singleLine = String(text || '').replace(/\s+/g, ' ').trim();
  return singleLine.length > max ? `${singleLine.slice(0, max - 1)}...` : singleLine;
}

function safeContext() {
  if (!getAssistantContext) return {};
  try {
    return getAssistantContext() || {};
  } catch {
    return {};
  }
}

function contextLines() {
  const { date, time, year, iso } = nowParts();
  const context = safeContext();
  const lines = [
    `Current local date: ${date}`,
    `Current local time: ${time}`,
    `Current year: ${year}`,
    `Current ISO timestamp: ${iso}`,
  ];

  const notes = Array.isArray(context.notes) ? context.notes.slice(0, MAX_CONTEXT_ITEMS) : [];
  lines.push(notes.length === 0
    ? 'Notes: none saved.'
    : `Notes: ${notes.map((n, i) => `${i + 1}. ${truncate(n.text)}`).join(' | ')}`);

  const reminders = Array.isArray(context.reminders)
    ? context.reminders.filter((r) => !r.completed).slice(0, MAX_CONTEXT_ITEMS)
    : [];
  lines.push(reminders.length === 0
    ? 'Upcoming reminders: none.'
    : `Upcoming reminders: ${reminders.map((r, i) =>
      `${i + 1}. ${truncate(r.text)} due ${new Date(r.dueAt).toLocaleString()}`).join(' | ')}`);

  const watchedFolders = Array.isArray(context.watchedFolders)
    ? context.watchedFolders.slice(0, MAX_CONTEXT_ITEMS)
    : [];
  lines.push(watchedFolders.length === 0
    ? 'Watched folders: none.'
    : `Watched folders: ${watchedFolders.join(' | ')}`);

  const actions = Array.isArray(context.actions) ? context.actions.slice(0, MAX_CONTEXT_ITEMS) : [];
  lines.push(actions.length === 0
    ? 'Saved actions: none.'
    : `Saved actions: ${actions.map((a, i) => `${i + 1}. ${truncate(a.name)} (${truncate(a.description || 'no description')})`).join(' | ')}`);

  return lines;
}

function buildSystemPrompt() {
  return `${SYSTEM_PROMPT}\n\nLOCAL CONTEXT:\n${contextLines().join('\n')}`;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((msg) => msg && (msg.who === 'you' || msg.who === 'kloppy')
      && typeof msg.text === 'string' && msg.text.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({
      role: msg.who === 'you' ? 'user' : 'assistant',
      content: truncate(msg.text, MAX_HISTORY_TEXT),
    }));
}

function localReply(reply, extra = {}) {
  return { ok: true, reply, local: true, ...extra };
}

function normalizeText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function isCancel(text) {
  return /^(cancel|never mind|nevermind|stop|forget it)\.?$/i.test(normalizeText(text));
}

function wantsDateOrTime(text) {
  const t = normalizeText(text).toLowerCase();
  return /\b(what|which)\s+(year|date|day|time)\b/.test(t)
    || /\bcurrent\s+(year|date|day|time)\b/.test(t)
    || /\bwhat'?s\s+(the\s+)?(year|date|day|time)\b/.test(t)
    || /\bwhat\s+year\s+is\s+it\b/.test(t)
    || /\bwhat\s+day\s+is\s+it\b/.test(t)
    || /\bwhat\s+time\s+is\s+it\b/.test(t);
}

function answerDateOrTime(text) {
  const { date, time, year } = nowParts();
  const t = normalizeText(text).toLowerCase();
  if (/\byear\b/.test(t) && !/\bdate\b/.test(t) && !/\bday\b/.test(t)) {
    return localReply(`It is ${year}. Kloppy checked the actual clock, not his vibes.`);
  }
  if (/\btime\b/.test(t) && !/\bdate\b/.test(t) && !/\bday\b/.test(t)) {
    return localReply(`It is ${time}. The clock continues its little performance.`);
  }
  return localReply(`It is ${date}, ${time}. The year is ${year}.`);
}

function wantsNoteList(text) {
  const t = normalizeText(text).toLowerCase();
  return /\bnotes?\b/.test(t) && /\b(what|show|list|read|have|saved|my)\b/.test(t);
}

function answerNoteList() {
  const notes = safeContext().notes || [];
  if (notes.length === 0) {
    return localReply('You have no notes yet. Kloppy opened the vault and found only theatrical dust.');
  }
  const lines = notes.slice(0, 10).map((note, i) => `${i + 1}. ${truncate(note.text, 180)}`);
  const suffix = notes.length > 10 ? ` Plus ${notes.length - 10} more, lurking politely.` : '';
  return localReply(`You have ${notes.length} note${notes.length === 1 ? '' : 's'}: ${lines.join(' ')}${suffix}`);
}

function extractNoteText(text) {
  const trimmed = normalizeText(text);
  const match = trimmed.match(/^(?:please\s+)?(?:make|add|create|save|take|write)\s+(?:a\s+)?note(?:\s+(?:that\s+says|saying|to|about|for))?(?:\s*[:\-]\s*|\s+)?(.+)?$/i);
  if (!match) return null;
  return normalizeText(match[1] || '');
}

function isNoteCommand(text) {
  return extractNoteText(text) !== null;
}

function addNoteFromChat(text) {
  if (!localActions || typeof localActions.addNote !== 'function') {
    return localReply('I can see notes, but I cannot write one from chat yet. Distressing bureaucracy.');
  }
  if (!text) {
    pendingAction = { type: 'note' };
    return localReply('What should the note say? Kloppy has opened a tiny filing cabinet.');
  }
  const result = localActions.addNote(text);
  if (!result.ok) {
    if (result.error === 'too-long') {
      return localReply(`That note is over ${result.max} characters. Kloppy refuses to become a storage unit.`);
    }
    return localReply('That note was empty. Kloppy cannot preserve pure absence.');
  }
  pendingAction = null;
  return localReply(`Note saved: "${truncate(result.note.text, 180)}"`);
}

function wantsReminderList(text) {
  const t = normalizeText(text).toLowerCase();
  return /\breminders?\b/.test(t) && /\b(what|show|list|read|have|saved|upcoming|due|my)\b/.test(t);
}

function answerReminderList() {
  const reminders = (safeContext().reminders || []).filter((r) => !r.completed);
  if (reminders.length === 0) {
    return localReply('You have no upcoming reminders. The alarm bells are unemployed.');
  }
  const sorted = reminders
    .slice()
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 10);
  const lines = sorted.map((r, i) =>
    `${i + 1}. ${truncate(r.text, 150)} due ${new Date(r.dueAt).toLocaleString()}`);
  const suffix = reminders.length > 10 ? ` Plus ${reminders.length - 10} more.` : '';
  return localReply(`You have ${reminders.length} upcoming reminder${reminders.length === 1 ? '' : 's'}: ${lines.join(' ')}${suffix}`);
}

function parseClockTime(timeText, base) {
  const match = normalizeText(timeText).match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59 || hour > 23) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour > 23) return null;
  const due = new Date(base);
  due.setHours(hour, minute, 0, 0);
  return due;
}

function parseDueDate(dueText) {
  const text = normalizeText(dueText).toLowerCase();
  const { now } = nowParts();

  const relative = text.match(/\bin\s+(\d+)\s+(minute|minutes|hour|hours|day|days)\b/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const ms = unit.startsWith('minute') ? amount * 60 * 1000
      : unit.startsWith('hour') ? amount * 60 * 60 * 1000
        : amount * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() + ms);
  }

  const tomorrow = text.match(/\btomorrow(?:\s+at\s+([0-9:]+\s*(?:am|pm)?))?/);
  if (tomorrow) {
    const base = new Date(now);
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);
    return tomorrow[1] ? parseClockTime(tomorrow[1], base) || base : base;
  }

  const today = text.match(/\btoday(?:\s+at\s+([0-9:]+\s*(?:am|pm)?))?/);
  if (today) {
    const base = new Date(now);
    base.setSeconds(0, 0);
    return today[1] ? parseClockTime(today[1], base) || base : base;
  }

  const atOnly = text.match(/^at\s+([0-9:]+\s*(?:am|pm)?)$/);
  if (atOnly) {
    const due = parseClockTime(atOnly[1], now);
    if (due && due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
    return due;
  }

  const onOnly = text.match(/^on\s+(.+)$/);
  if (onOnly) {
    const parsed = Date.parse(onOnly[1]);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }

  const explicit = Date.parse(dueText);
  return Number.isNaN(explicit) ? null : new Date(explicit);
}

function extractReminder(text) {
  const trimmed = normalizeText(text);
  const match = trimmed.match(/^(?:please\s+)?(?:(?:set|add|create|save)\s+(?:a\s+)?reminder(?:\s+to)?|remind\s+me\s+to)\s+(.+)$/i);
  if (!match) return null;

  let body = normalizeText(match[1]);
  const inMatch = body.match(/\s+\bin\s+\d+\s+(?:minute|minutes|hour|hours|day|days)\b.*$/i);
  const tomorrowMatch = body.match(/\s+\btomorrow(?:\s+at\s+[0-9:]+\s*(?:am|pm)?)?.*$/i);
  const todayMatch = body.match(/\s+\btoday(?:\s+at\s+[0-9:]+\s*(?:am|pm)?)?.*$/i);
  const atMatch = body.match(/\s+\bat\s+(.+)$/i);
  const onMatch = body.match(/\s+\bon\s+(.+)$/i);
  const dueMatch = inMatch || tomorrowMatch || todayMatch || onMatch || atMatch;
  if (!dueMatch) return { text: body, dueAt: null };

  const dueText = normalizeText(dueMatch[0]);
  body = normalizeText(body.slice(0, dueMatch.index));
  if (!body) body = normalizeText(match[1].replace(dueMatch[0], ''));
  return { text: body, dueAt: parseDueDate(dueText) };
}

function isReminderCommand(text) {
  return extractReminder(text) !== null;
}

function addReminderFromChat(text, dueAt) {
  if (!localActions || typeof localActions.addReminder !== 'function') {
    return localReply('I can see reminders, but I cannot create one from chat yet. Paperwork has won this round.');
  }
  if (!text) {
    pendingAction = { type: 'reminder-text' };
    return localReply('What should I remind you about? Kloppy is holding the bell ominously.');
  }
  if (!dueAt) {
    pendingAction = { type: 'reminder-due', text };
    return localReply(`When should I remind you about "${truncate(text, 120)}"? Try "tomorrow at 9am" or "in 10 minutes."`);
  }
  const result = localActions.addReminder(text, dueAt.toISOString());
  if (!result.ok) {
    if (result.error === 'too-long') {
      return localReply(`That reminder is over ${result.max} characters. Kloppy's bell has limits.`);
    }
    return localReply('I could not save that reminder. The date may be cursed.');
  }
  pendingAction = null;
  return localReply(`Reminder set: "${truncate(result.reminder.text, 150)}" due ${new Date(result.reminder.dueAt).toLocaleString()}.`);
}

function handlePendingAction(prompt) {
  if (!pendingAction) return null;
  if (isCancel(prompt)) {
    pendingAction = null;
    return localReply('Canceled. Kloppy closes the tiny drawer with unnecessary drama.');
  }
  if (pendingAction.type === 'note') {
    return addNoteFromChat(normalizeText(prompt));
  }
  if (pendingAction.type === 'reminder-text') {
    pendingAction = { type: 'reminder-due', text: normalizeText(prompt) };
    return localReply(`When should I remind you about "${truncate(prompt, 120)}"?`);
  }
  if (pendingAction.type === 'reminder-due') {
    const dueAt = parseDueDate(prompt);
    if (!dueAt) {
      return localReply('I could not parse that time. Try "tomorrow at 9am", "today at 5pm", or "in 10 minutes."');
    }
    return addReminderFromChat(pendingAction.text, dueAt);
  }
  return null;
}

function handleLocalIntent(prompt) {
  if (isCancel(prompt) && pendingAction) {
    pendingAction = null;
    return localReply('Canceled. Kloppy drops the clipboard into a tasteful void.');
  }
  if (wantsDateOrTime(prompt)) return answerDateOrTime(prompt);
  if (wantsNoteList(prompt)) return answerNoteList();
  if (wantsReminderList(prompt)) return answerReminderList();
  if (isNoteCommand(prompt)) return addNoteFromChat(extractNoteText(prompt));
  if (isReminderCommand(prompt)) {
    const reminder = extractReminder(prompt);
    return addReminderFromChat(reminder.text, reminder.dueAt);
  }
  return handlePendingAction(prompt);
}

async function waitForHealthy(proc) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc !== child) {
      return false; // server died (or was replaced) while loading
    }
    try {
      const res = await fetch(`${baseUrl()}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return true;
    } catch {
      // not listening yet — keep polling
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return false;
}

async function start() {
  const modelPath = getModelPath();
  if (!modelPath) {
    setStatus('not-configured');
    return false;
  }
  if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isFile()) {
    setStatus('error', 'model-missing');
    return false;
  }

  setStatus('starting');
  try {
    port = await findFreePort();
  } catch {
    setStatus('error', 'no-port');
    return false;
  }

  const args = ['--server', '--host', '127.0.0.1', '--port', String(port)];
  try {
    child = spawn(modelPath, args, {
      stdio: 'ignore',
      windowsHide: true,
      env: childEnv(),
    });
  } catch {
    child = null;
    setStatus('error', 'spawn-failed');
    return false;
  }
  runningPath = modelPath;

  const proc = child;
  proc.once('error', () => {
    if (proc === child) {
      child = null;
      setStatus('error', 'spawn-failed');
    }
  });
  proc.once('exit', () => {
    if (proc === child) {
      child = null;
      // Deliberate stop() is not an error; anything else means it crashed
      // (or the "llamafile" wasn't one).
      if (!stopping) setStatus('error', 'crashed');
    }
  });

  const healthy = await waitForHealthy(proc);
  if (!healthy) {
    if (proc === child) {
      stopping = true;
      proc.kill();
      child = null;
      stopping = false;
      setStatus('error', 'no-response');
    }
    return false;
  }

  setStatus('ready');
  return true;
}

// Ensures a healthy server for the currently-configured model path.
// Concurrent callers share one startup; a changed path replaces the server.
async function ensureReady() {
  if (child && status.state === 'ready') {
    if (runningPath === getModelPath()) return true;
    await stop(); // user pointed at a different model — swap servers
  }
  if (!startPromise) {
    startPromise = start().finally(() => {
      startPromise = null;
    });
  }
  return startPromise;
}

async function ask(prompt, history = []) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: 'too-long', max: MAX_PROMPT_LENGTH };
  }
  const localResult = handleLocalIntent(prompt);
  if (localResult) return localResult;

  if (askInFlight) {
    return { ok: false, error: 'busy' };
  }

  askInFlight = true;
  try {
    const ready = await ensureReady();
    if (!ready) {
      // status already says why (not-configured / model-missing / ...)
      return {
        ok: false,
        error: status.state === 'not-configured' ? 'not-configured' : 'start-failed',
        detail: status.detail,
      };
    }

    let res;
    try {
      res = await fetch(`${baseUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
        body: JSON.stringify({
          model: 'local', // llamafile serves exactly one model; name is ignored
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...sanitizeHistory(history),
            { role: 'user', content: prompt.trim() },
          ],
          max_tokens: MAX_REPLY_TOKENS,
          temperature: 0.7,
        }),
      });
    } catch {
      return { ok: false, error: 'request-failed' };
    }
    if (!res.ok) {
      return { ok: false, error: 'request-failed' };
    }

    let reply;
    try {
      const data = await res.json();
      reply = data.choices?.[0]?.message?.content;
    } catch {
      reply = null;
    }
    if (typeof reply !== 'string' || reply.trim().length === 0) {
      return { ok: false, error: 'bad-reply' };
    }
    return { ok: true, reply: reply.trim() };
  } finally {
    askInFlight = false;
  }
}

// Kills the server. Called on app quit and when the model path changes.
function stop() {
  return new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    stopping = true;
    const proc = child;
    child = null;
    runningPath = null;
    proc.once('exit', () => {
      stopping = false;
      resolve();
    });
    proc.kill();
    // Insurance: if SIGTERM is ignored, escalate rather than orphan it.
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, 3000).unref();
  });
}

module.exports = { init, getStatus, ask, stop, refreshStatus };
