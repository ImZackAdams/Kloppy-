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

const STARTUP_TIMEOUT_MS = 90 * 1000; // big models take a while to load
const HEALTH_POLL_MS = 500;
const REPLY_TIMEOUT_MS = 120 * 1000;
const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_TOKENS = 300;

const SYSTEM_PROMPT =
  'You are Kloppy, a sardonic but harmless retro desktop assistant gremlin ' +
  'shaped like a paperclip. You live in the user\'s taskbar. Reply in one to ' +
  'three short sentences, deadpan and a little unhinged, but always actually ' +
  'answer the user\'s question or request first. Never use markdown.';

let getModelPath = null;    // injected by main.js; reads the settings file
let getSetupStatus = null;  // injected by main.js; first-run download state
let broadcast = null;       // injected by main.js; pushes status to windows

let child = null;        // running llamafile server, if any
let runningPath = null;  // model path the current child was started with
let port = null;
let startPromise = null; // shared by concurrent asks so we spawn only once
let askInFlight = false;
let stopping = false;    // suppresses the exit handler during deliberate kills

// Internal runtime state: not-configured | idle | starting | ready | error
// ("idle" = a model path is configured but the server hasn't been needed
// yet; public llm:status maps that to setup state "ready" with a runtime
// field.) detail: machine-readable reason for error states.
let status = { state: 'not-configured', detail: '' };

function init(options) {
  getModelPath = options.getModelPath;
  getSetupStatus = options.getSetupStatus || null;
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

  const args = ['--server', '--nobrowser', '--host', '127.0.0.1', '--port', String(port)];
  try {
    // llamafiles are polyglot binaries that need a shell to bootstrap on
    // POSIX systems; on Windows they run directly (renamed to .exe).
    child = process.platform === 'win32'
      ? spawn(modelPath, args, { stdio: 'ignore', windowsHide: true })
      : spawn('/bin/sh', [modelPath, ...args], { stdio: 'ignore' });
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

async function ask(prompt) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { ok: false, error: 'empty' };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: 'too-long', max: MAX_PROMPT_LENGTH };
  }
  if (askInFlight) {
    return { ok: false, error: 'busy' };
  }

  askInFlight = true;
  try {
    const ready = await ensureReady();
    if (!ready) {
      // status already says why (not-configured / model-missing / ...)
      return { ok: false, error: status.state === 'not-configured' ? 'not-configured' : 'start-failed' };
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
            { role: 'system', content: SYSTEM_PROMPT },
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
