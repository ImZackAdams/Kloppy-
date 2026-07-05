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
const REPLY_TIMEOUT_MS = 180 * 1000; // 500 tokens on a slow everyday CPU can take minutes
const HEALTH_CHECK_TIMEOUT_MS = 3 * 1000;
const CONTEXT_TOKENS = 8192;     // bounded KV cache; llamafile's default (0) means "model max", which can be enormous
const CACHE_REUSE_TOKENS = 256;  // min chunk the server may shift-reuse from the prompt cache
const MAX_CONSECUTIVE_START_FAILURES = 3;
const SERVER_LOG_MAX_BYTES = 512 * 1024;
const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_TOKENS = 500;
const MAX_CONTEXT_ITEMS = 8;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_TEXT = 800;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'all', 'and', 'any', 'are', 'but', 'can',
  'could', 'did', 'does', 'for', 'from', 'have', 'how', 'into', 'list',
  'make', 'note', 'notes', 'please', 'remind', 'reminder', 'reminders',
  'show', 'that', 'the', 'this', 'what', 'when', 'where', 'which', 'who',
  'why', 'with', 'you', 'your',
]);

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
let launching = false;   // suppresses "crashed" while the startup ladder is still trying
let argsProfile = null;  // launch profile that last produced a healthy server
let profilePath = null;  // model path that profile was proven against
let startFailures = 0;   // consecutive failed start() ladders; gates the crash-loop brake
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
  pendingAction = null;
  askInFlight = false;
  argsProfile = null;
  profilePath = null;
  startFailures = 0;
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
  startFailures = 0; // a settings change is the user's "try again" signal
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

// Launch profiles, tried in order until one yields a healthy server:
//   tuned      — performance flags, GPU offload if the machine has one
//   tuned-cpu  — same flags but GPU disabled, for broken drivers / low VRAM
//   minimal    — bare flags every llamafile release understands, so a
//                user-supplied older binary still works
const ARG_PROFILES = ['tuned', 'tuned-cpu', 'minimal'];

function buildServerArgs(profile, serverPort) {
  const args = ['--server', '--host', '127.0.0.1', '--port', String(serverPort)];
  if (profile === 'minimal') return args;
  args.push(
    '--no-webui',                          // API only; keep the bundled web UI off localhost
    '--parallel', '1',                     // one chat slot gets the whole context window
    '--ctx-size', String(CONTEXT_TOKENS),
    '--cache-reuse', String(CACHE_REUSE_TOKENS),
  );
  if (profile === 'tuned-cpu') args.push('--gpu', 'disable');
  return args;
}

function serverLogPath() {
  const runtimeDir = getLlamafileHomeDir ? getLlamafileHomeDir() : null;
  return runtimeDir ? path.join(runtimeDir, 'server.log') : null;
}

// Keeps the server's output for post-mortems (truncated per launch, capped
// in size) instead of throwing it away. Failing to log never blocks the
// server, but the pipes must always be drained.
function attachServerLog(proc, args) {
  const drain = () => {
    if (proc.stdout) proc.stdout.resume();
    if (proc.stderr) proc.stderr.resume();
  };
  const logPath = serverLogPath();
  if (!logPath) {
    drain();
    return;
  }

  let stream;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    stream = fs.createWriteStream(logPath, { flags: 'w' });
  } catch {
    drain();
    return;
  }

  stream.on('error', drain);
  let written = 0;
  const write = (chunk) => {
    if (written >= SERVER_LOG_MAX_BYTES) return;
    written += chunk.length;
    stream.write(chunk);
  };
  stream.write(`[kloppy] launch: ${args.join(' ')}\n`);
  if (proc.stdout) proc.stdout.on('data', write);
  if (proc.stderr) proc.stderr.on('data', write);
  proc.once('close', () => stream.end());
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

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function scoreText(text, tokens) {
  const haystack = normalizeText(text).toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function pickItems(items, prompt, getText) {
  if (!Array.isArray(items)) return [];
  const tokens = tokenize(prompt);
  if (tokens.length === 0) return items.slice(0, MAX_CONTEXT_ITEMS);

  const scored = items.map((item, index) => ({
    item,
    index,
    score: scoreText(getText(item), tokens),
  }));
  const relevant = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);

  return (relevant.length > 0 ? relevant : items).slice(0, MAX_CONTEXT_ITEMS);
}

function contextLines(prompt = '') {
  const { date, time, year, iso } = nowParts();
  const context = safeContext();
  const userName = normalizeText(context.profile?.userName || '');
  const lines = [
    userName
      ? `User profile: user's name is ${userName}. Kloppy is the assistant, not the user.`
      : 'User profile: name is not known yet. Ask the user to say "my name is ..." if needed.',
  ];

  const notes = pickItems(context.notes, prompt, (note) => `${note.text} ${note.createdAt || ''}`);
  lines.push(notes.length === 0
    ? 'Notes: none saved.'
    : `Relevant/recent notes: ${notes.map((n, i) => `${i + 1}. ${truncate(n.text)}`).join(' | ')}`);

  const reminderPool = Array.isArray(context.reminders)
    ? context.reminders.filter((r) => !r.completed)
    : [];
  const reminders = pickItems(reminderPool, prompt, (reminder) =>
    `${reminder.text} ${reminder.dueAt || ''}`);
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

  const actions = pickItems(context.actions, prompt, (action) =>
    `${action.name} ${action.description || ''} ${action.command || ''}`);
  lines.push(actions.length === 0
    ? 'Saved actions: none.'
    : `Saved actions: ${actions.map((a, i) => `${i + 1}. ${truncate(a.name)} (${truncate(a.description || 'no description')})`).join(' | ')}`);

  // The clock goes last: everything above changes rarely, so the server can
  // reuse its cached prompt prefix between asks. A timestamp at the top
  // would invalidate the whole cache on every message.
  lines.push(
    `Current local date: ${date}`,
    `Current local time: ${time}`,
    `Current year: ${year}`,
    `Current ISO timestamp: ${iso}`,
  );

  return lines;
}

function buildSystemPrompt(prompt) {
  return `${SYSTEM_PROMPT}\n\nLOCAL CONTEXT:\n${contextLines(prompt).join('\n')}`;
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

function sanitizeUserName(name) {
  const cleaned = normalizeText(name)
    .replace(/^["']+|["'.!,?]+$/g, '')
    .replace(/\b(my name|name)\b.*$/i, '')
    .trim();
  if (!cleaned || cleaned.length > 80) return '';
  if (!/^[a-zA-Z][a-zA-Z0-9 ._'’-]{0,79}$/.test(cleaned)) return '';
  return cleaned;
}

function extractUserName(text) {
  const trimmed = normalizeText(text);
  const patterns = [
    /^(?:please\s+)?(?:remember\s+)?my\s+name\s+is\s+(.+)$/i,
    /^(?:please\s+)?(?:remember\s+)?call\s+me\s+(.+)$/i,
    /^(?:please\s+)?(?:remember\s+)?i\s+am\s+([A-Z][a-zA-Z0-9 ._'’-]{0,79})$/,
    /^(?:please\s+)?(?:remember\s+)?i'm\s+([A-Z][a-zA-Z0-9 ._'’-]{0,79})$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return sanitizeUserName(match[1]);
  }
  return null;
}

function wantsUserName(text) {
  const t = normalizeText(text).toLowerCase();
  return /\bwhat(?:'s| is)\s+my\s+name\b/.test(t)
    || /\bwho\s+am\s+i\b/.test(t)
    || /\bdo\s+you\s+know\s+my\s+name\b/.test(t);
}

function answerUserName() {
  const userName = sanitizeUserName(safeContext().profile?.userName || '');
  if (!userName) {
    return localReply('I do not know your name yet. Say "my name is Zack" and I will store it locally, like a responsible little clipboard.');
  }
  return localReply(`Your name is ${userName}. Kloppy knows because you told him, not because he did detective work.`);
}

function setUserNameFromChat(userName) {
  if (!localActions || typeof localActions.setUserName !== 'function') {
    return localReply('I can hear the name, but I cannot save it yet. A tragic permissions opera.');
  }
  if (!userName) {
    return localReply('I could not parse that as a name. Try "my name is Zack."');
  }
  const result = localActions.setUserName(userName);
  if (!result.ok) {
    return localReply('I could not save that name. It may be too long for Kloppy\'s tiny name tag.');
  }
  return localReply(`Got it. Your name is ${result.settings.userName}. Stored locally, where the internet cannot sniff it.`);
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
  const userName = extractUserName(prompt);
  if (userName !== null) return setUserNameFromChat(userName);
  if (wantsUserName(prompt)) return answerUserName();
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

// One launch attempt with one profile. Returns null on success, or a
// machine-readable failure reason. Does not touch the public status so the
// ladder in start() can keep showing "starting" between attempts.
async function startWithProfile(modelPath, profile) {
  try {
    port = await findFreePort();
  } catch {
    return 'no-port';
  }

  const args = buildServerArgs(profile, port);
  try {
    child = spawn(modelPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: childEnv(),
    });
  } catch {
    child = null;
    return 'spawn-failed';
  }
  runningPath = modelPath;
  attachServerLog(child, args);

  let spawnFailed = false;
  const proc = child;
  proc.once('error', () => {
    if (proc === child) {
      child = null;
      spawnFailed = true;
    }
  });
  proc.once('exit', () => {
    if (proc !== child) return;
    child = null;
    // Deliberate stop() and failed launch attempts are not runtime crashes;
    // anything else means it died under us (or the "llamafile" wasn't one).
    if (!stopping && !launching) setStatus('error', 'crashed');
  });

  const healthy = await waitForHealthy(proc);
  if (!healthy) {
    if (proc === child) {
      stopping = true;
      proc.kill();
      child = null;
      stopping = false;
      return 'no-response'; // process alive but never answered health checks
    }
    return spawnFailed ? 'spawn-failed' : 'crashed'; // exited while loading
  }
  return null;
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

  if (modelPath !== profilePath) {
    // Different model file: forget what we learned about the previous one.
    profilePath = modelPath;
    argsProfile = null;
    startFailures = 0;
  }
  if (startFailures >= MAX_CONSECUTIVE_START_FAILURES) {
    // Crash-loop brake: stop respawning a server that keeps dying. Changing
    // any setting (refreshStatus) arms it again.
    setStatus('error', 'crash-loop');
    return false;
  }

  setStatus('starting');
  launching = true;
  let reason = 'no-response';
  try {
    // A proven profile is retried alone; otherwise walk the ladder.
    const profiles = argsProfile ? [argsProfile] : ARG_PROFILES;
    for (const profile of profiles) {
      reason = await startWithProfile(modelPath, profile);
      if (reason === null) {
        argsProfile = profile;
        startFailures = 0;
        setStatus('ready');
        return true;
      }
      if (reason === 'no-port') break; // not the flags' fault; retrying won't help
    }
  } finally {
    launching = false;
  }

  startFailures += 1;
  setStatus('error',
    startFailures >= MAX_CONSECUTIVE_START_FAILURES ? 'crash-loop' : reason);
  return false;
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

async function serverAlive() {
  try {
    const res = await fetch(`${baseUrl()}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Pulls the user-visible reply out of a chat completion. Thinking models
// can put their scratchpad in reasoning_content (ignored) or leak it into
// content as <think> tags (stripped); an unclosed tag means the model spent
// its whole token budget thinking and never answered.
function extractReply(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;
  const reply = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();
  return reply.length > 0 ? reply : null;
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
    // Two passes: if the server turns out to be dead or wedged on the first,
    // it is stopped and relaunched once before giving up.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const ready = await ensureReady();
      if (!ready) {
        // status already says why (not-configured / model-missing / ...)
        return {
          ok: false,
          error: status.state === 'not-configured' ? 'not-configured' : 'start-failed',
          detail: status.detail,
        };
      }

      if (!(await serverAlive())) {
        await stop(); // wedged or silently dead; costs ~ms when healthy
        continue;
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
              { role: 'system', content: buildSystemPrompt(prompt) },
              ...sanitizeHistory(history),
              { role: 'user', content: prompt.trim() },
            ],
            max_tokens: MAX_REPLY_TOKENS,
            temperature: 0.7,
            top_p: 0.9,
            min_p: 0.05,        // keeps small quantized models off garbage tokens
            cache_prompt: true, // reuse the system-prompt KV between asks
          }),
        });
      } catch {
        if (!child || child.exitCode !== null) {
          await stop(); // server died mid-request — relaunch and retry once
          continue;
        }
        return { ok: false, error: 'request-failed' };
      }
      if (!res.ok) {
        return { ok: false, error: 'request-failed' };
      }

      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      const reply = extractReply(data);
      if (!reply) {
        return { ok: false, error: 'bad-reply' };
      }
      return { ok: true, reply };
    }
    return { ok: false, error: 'request-failed' };
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

module.exports = { init, getStatus, ask, stop, refreshStatus, buildServerArgs, extractReply };
