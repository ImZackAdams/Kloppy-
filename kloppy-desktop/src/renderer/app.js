// Kloppy renderer logic.
// Buttons swap the main panel, make Kloppy talk, and update the status bar.
// Notes are real: stored on disk via the preload bridge (window.kloppy.notes).

// ---- Kloppy's words of wisdom ----

const quips = [
  "It looks like you're making questionable decisions.",
  "Have you tried turning your life off and on again?",
  "I saw what you did. I'm not mad, just... logging it.",
  "Pro tip: if you never save, you can never lose unsaved work.",
  "I live in your taskbar now. This is fine for both of us.",
  "Error 404: motivation not found. Retrying forever.",
  "Fun fact: every unread notification makes me stronger.",
];

// ---- Static panels (placeholders until their features arrive) ----

const panels = {
  welcome: {
    title: 'WELCOME.TXT',
    body: `
      <p>Kloppy is a desktop gremlin. He lives in this window now.</p>
      <p>Press a button below. Kloppy is waiting. Kloppy is patient.*</p>
      <p class="fine-print">* Kloppy is not patient.</p>`,
  },
  about: {
    title: 'ABOUT.TXT',
    body: `
      <p><b>Kloppy v0.0.1</b></p>
      <p>Legally distinct desktop gremlin.</p>
      <ul>
        <li>Local-first: notes, reminders, settings, actions — all on this machine</li>
        <li>No cloud account</li>
        <li>No data upload</li>
        <li>One optional network request ever: the first-run model download, only if you choose it</li>
        <li>After that, Kloppy works fully offline</li>
      </ul>
      <p class="fine-print">Kloppy cannot phone home. Kloppy does not know what home is.
        The model fetch is a pinned file with a checksum, not a lifestyle.</p>`,
  },
};

const statusLines = {
  idle: 'Kloppy is idle, suspiciously.',
  say: 'Kloppy is saying words. Nobody asked.',
  settings: 'Kloppy resents being configured.',
  noteSaved: 'Note swallowed whole. It is safe now. Probably.',
  noteDeleted: 'Note shredded. Kloppy ate the shreds.',
  noteEmpty: 'Kloppy refuses to store the concept of nothing.',
  noteTooLong: "That's a novel, not a note. 500 characters max.",
};

// ---- DOM helpers ----

const bubbleText = document.getElementById('bubble-text');
const panelTitle = document.getElementById('panel-title');
const panelBody = document.getElementById('panel-body');
const statusText = document.getElementById('status-text');

function say(text) {
  bubbleText.textContent = text;
}

function setStatus(text) {
  statusText.textContent = text;
}

function showPanel(name) {
  panelTitle.textContent = panels[name].title;
  panelBody.innerHTML = panels[name].body;
}

// Highlight the button whose panel is on screen, so navigation reads clearly.
function setActiveButton(id) {
  for (const btn of document.querySelectorAll('.button-row button')) {
    btn.classList.toggle('active', btn.id === id);
  }
}

// Safety net: any failed IPC call (or other stray async error) surfaces as a
// Kloppy message instead of dying silently in the console.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  say('Something failed inside my tiny brain. Try that again.');
  setStatus('Internal error. Kloppy blames cosmic rays.');
});

// ---- Notes panel ----

async function openNotes() {
  panelTitle.textContent = 'NOTES.DAT';
  panelBody.innerHTML = `
    <div class="note-editor">
      <textarea id="note-input" rows="3"
        placeholder="Type a note. Kloppy will guard it."></textarea>
      <button id="note-save" type="button">Save note</button>
    </div>
    <p class="fine-print">Stored locally in notes.json. Kloppy never phones home. 500 chars max.</p>
    <ul class="note-list" id="note-list"></ul>`;

  const input = document.getElementById('note-input');
  document.getElementById('note-save').addEventListener('click', saveNote);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNote();
  });

  await refreshNotes();
}

async function refreshNotes() {
  const result = await window.kloppy.notes.list();
  const listEl = document.getElementById('note-list');
  listEl.textContent = '';

  for (const note of result.notes) {
    // Built with createElement + textContent so note text is never
    // interpreted as HTML.
    const li = document.createElement('li');
    li.className = 'note';

    const text = document.createElement('p');
    text.className = 'note-text';
    text.textContent = note.text;

    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const date = document.createElement('span');
    date.textContent = new Date(note.createdAt).toLocaleString();

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-delete';
    del.textContent = 'Shred';
    del.addEventListener('click', async () => {
      await window.kloppy.notes.remove(note.id);
      say('It never existed. We never speak of it again.');
      setStatus(statusLines.noteDeleted);
      await refreshNotes();
    });

    meta.append(date, del);
    li.append(text, meta);
    listEl.appendChild(li);
  }

  if (result.notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'note note-empty';
    empty.textContent = 'No notes yet. Kloppy guards an empty vault.';
    listEl.appendChild(empty);
  }
}

async function saveNote() {
  const input = document.getElementById('note-input');
  const result = await window.kloppy.notes.add(input.value);

  if (!result.ok) {
    if (result.error === 'empty') {
      say('You want me to remember... nothing? Bold. No.');
      setStatus(statusLines.noteEmpty);
    } else if (result.error === 'too-long') {
      say(`That note is over ${result.max} characters. I'm a gremlin, not a library.`);
      setStatus(statusLines.noteTooLong);
    }
    return;
  }

  input.value = '';
  say('Note saved. I am guarding it with moderate enthusiasm.');
  setStatus(statusLines.noteSaved);
  await refreshNotes();
}

// ---- Reminders panel ----

async function openReminders() {
  panelTitle.textContent = 'REMIND.SYS';
  panelBody.innerHTML = `
    <div class="reminder-editor">
      <input id="reminder-text" type="text"
        placeholder="What should Kloppy yell about?">
      <input id="reminder-when" type="datetime-local" step="1">
      <button id="reminder-save" type="button">Set reminder</button>
    </div>
    <p class="fine-print">Kloppy checks the clock every 30 seconds. He is extremely dedicated.</p>
    <h3 class="list-heading">UPCOMING</h3>
    <ul class="note-list" id="reminder-upcoming"></ul>
    <h3 class="list-heading">ALREADY YELLED ABOUT</h3>
    <ul class="note-list" id="reminder-done"></ul>`;

  document.getElementById('reminder-save').addEventListener('click', saveReminder);
  await refreshReminders();
}

function reminderItem(reminder) {
  // Built with createElement + textContent so reminder text is never
  // interpreted as HTML.
  const li = document.createElement('li');
  li.className = reminder.completed ? 'note done' : 'note';

  const text = document.createElement('p');
  text.className = 'note-text';
  text.textContent = reminder.text;

  const meta = document.createElement('div');
  meta.className = 'note-meta';

  const due = document.createElement('span');
  due.textContent = 'due ' + new Date(reminder.dueAt).toLocaleString();

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'note-delete';
  del.textContent = 'Forget';
  del.addEventListener('click', async () => {
    await window.kloppy.reminders.remove(reminder.id);
    say('Forgotten. Kloppy has already moved on emotionally.');
    setStatus('Reminder defused. Kloppy stands down.');
    await refreshReminders();
  });

  meta.append(due, del);
  li.append(text, meta);
  return li;
}

function emptyItem(listEl, message) {
  const li = document.createElement('li');
  li.className = 'note note-empty';
  li.textContent = message;
  listEl.appendChild(li);
}

async function refreshReminders() {
  const upcomingEl = document.getElementById('reminder-upcoming');
  const doneEl = document.getElementById('reminder-done');
  if (!upcomingEl) return; // reminder panel is not on screen right now

  const result = await window.kloppy.reminders.list();
  const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);

  upcomingEl.textContent = '';
  doneEl.textContent = '';
  for (const r of result.reminders.filter((r) => !r.completed).sort(byDue)) {
    upcomingEl.appendChild(reminderItem(r));
  }
  for (const r of result.reminders.filter((r) => r.completed).sort(byDue)) {
    doneEl.appendChild(reminderItem(r));
  }
  if (upcomingEl.children.length === 0) {
    emptyItem(upcomingEl, 'Nothing scheduled. Kloppy relaxes. Slightly.');
  }
  if (doneEl.children.length === 0) {
    emptyItem(doneEl, 'Nothing yelled about yet.');
  }
}

async function saveReminder() {
  const textInput = document.getElementById('reminder-text');
  const whenInput = document.getElementById('reminder-when');
  const result = await window.kloppy.reminders.add(textInput.value, whenInput.value);

  if (!result.ok) {
    if (result.error === 'empty') {
      say('Remind you of... nothing? Done. Wait. No.');
      setStatus('Kloppy cannot yell about nothing.');
    } else if (result.error === 'too-long') {
      say(`Keep it under ${result.max} characters. Kloppy yells in short bursts.`);
      setStatus('Reminder too long. Kloppy has limited lungs.');
    } else if (result.error === 'bad-date') {
      say('That is not a time. Kloppy is a gremlin, but he respects clocks.');
      setStatus('Reminder needs a valid date and time.');
    }
    return;
  }

  textInput.value = '';
  whenInput.value = '';
  say('Reminder armed. I am watching the clock. Menacingly.');
  setStatus('Reminder armed. Kloppy never blinks. Except constantly.');
  await refreshReminders();
}

// ---- Due-reminder checking + the alert popup ----

const REMINDER_CHECK_MS = 30 * 1000;
const popupQueue = [];
const popupOverlay = document.getElementById('popup-overlay');
const popupText = document.getElementById('popup-text');

// Popups show one at a time; extra due reminders wait their turn.
function queuePopup(text) {
  popupQueue.push(text);
  if (popupOverlay.classList.contains('hidden')) showNextPopup();
}

function showNextPopup() {
  const next = popupQueue.shift();
  if (next === undefined) {
    popupOverlay.classList.add('hidden');
    return;
  }
  popupText.textContent = next;
  popupOverlay.classList.remove('hidden');
}

document.getElementById('popup-ok').addEventListener('click', showNextPopup);

async function checkDueReminders() {
  const result = await window.kloppy.reminders.list();
  const now = new Date();
  const due = result.reminders.filter(
    (r) => !r.completed && new Date(r.dueAt) <= now
  );

  for (const r of due) {
    await window.kloppy.reminders.complete(r.id);
    queuePopup(r.text);
  }

  if (due.length > 0) {
    say('DING DING DING. I did my one job.');
    setStatus('Kloppy yelled about a reminder. Duty fulfilled.');
    await refreshReminders(); // no-op unless the reminder panel is open
  }
}

setInterval(checkDueReminders, REMINDER_CHECK_MS);
checkDueReminders(); // catch anything that came due while Kloppy was asleep

// ---- Settings panel ----

let currentSettings = null;

function applyTheme(theme) {
  // Theme variables live on body[data-theme] in styles.css.
  document.body.dataset.theme = theme;
}

// How often Kloppy speaks up on his own, per frequency setting.
const COMMENTARY_MS = {
  low: 5 * 60 * 1000,
  medium: 2 * 60 * 1000,
  cursed: 45 * 1000,
};

let commentaryTimer = null;

function setupCommentary() {
  clearInterval(commentaryTimer);
  commentaryTimer = null;
  if (!currentSettings || !currentSettings.randomCommentary) return;

  const delay = COMMENTARY_MS[currentSettings.commentaryFrequency] || COMMENTARY_MS.medium;
  commentaryTimer = setInterval(() => {
    // "cursed" frequency also draws from the cursed pool.
    const pool = currentSettings.commentaryFrequency === 'cursed' ? cursedLines : quips;
    say(pool[Math.floor(Math.random() * pool.length)]);
    setStatus('Kloppy commented. Unprompted. As foretold.');
  }, delay);
}

async function saveSetting(key, value) {
  const result = await window.kloppy.settings.update({ [key]: value });
  if (!result.ok) {
    setStatus('Kloppy rejected that setting. He has standards, apparently.');
    return;
  }
  currentSettings = result.settings;
  applyTheme(currentSettings.theme);
  setupCommentary();
  setStatus('Setting absorbed. Kloppy adapts. Reluctantly.');
}

async function openSettings() {
  panelTitle.textContent = 'SETTINGS.INI';
  const s = currentSettings;
  panelBody.innerHTML = `
    <label class="fake-option">
      <input type="checkbox" id="set-launch-min"> Launch minimized
      <span class="fine-print">(stored now, honored in a future version)</span>
    </label>
    <label class="fake-option">
      <input type="checkbox" id="set-commentary"> Random commentary while the app is open
    </label>
    <label class="fake-option">Commentary frequency
      <select id="set-frequency">
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="cursed">cursed</option>
      </select>
    </label>
    <label class="fake-option">Theme
      <select id="set-theme">
        <option value="midnight">midnight</option>
        <option value="beige">beige</option>
        <option value="toxic">toxic green</option>
      </select>
    </label>
    <label class="fake-option model-path-option">Local model path
      <input type="text" id="set-model-path" placeholder="/path/to/model.llamafile">
      <span class="fine-print">Point this at a llamafile executable to give Kloppy a real
        brain for the Chat panel. It runs entirely on this machine.</span>
    </label>
    <p class="fine-print">Saved instantly to settings.json. Kloppy pretends not to care.</p>`;

  const launchMin = document.getElementById('set-launch-min');
  const commentary = document.getElementById('set-commentary');
  const frequency = document.getElementById('set-frequency');
  const theme = document.getElementById('set-theme');
  const modelPath = document.getElementById('set-model-path');

  launchMin.checked = s.launchMinimized;
  commentary.checked = s.randomCommentary;
  frequency.value = s.commentaryFrequency;
  theme.value = s.theme;
  modelPath.value = s.modelPath;

  launchMin.addEventListener('change', () => saveSetting('launchMinimized', launchMin.checked));
  commentary.addEventListener('change', () => saveSetting('randomCommentary', commentary.checked));
  frequency.addEventListener('change', () => saveSetting('commentaryFrequency', frequency.value));
  theme.addEventListener('change', () => saveSetting('theme', theme.value));
  modelPath.addEventListener('change', () => saveSetting('modelPath', modelPath.value));
}

async function loadSettings() {
  const result = await window.kloppy.settings.get();
  currentSettings = result.settings;
  applyTheme(currentSettings.theme);
  setupCommentary();
}

// ---- First-run local model setup ----

let llmStatus = { state: 'not-configured', detail: '' };

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function setupFailureLine(detail) {
  const lines = {
    canceled: 'Download canceled. Partial file erased. Kloppy accepts this plot twist.',
    'bad-checksum': 'Checksum mismatch. Partial file erased. Kloppy refuses counterfeit brains.',
    'settings-save-failed': 'Downloaded, verified, then settings refused to save. Rude.',
    busy: 'A download is already in progress. One enormous file at a time.',
  };
  if (detail && detail.startsWith('http-')) {
    return 'The server refused the download. Partial file erased. Retry is allowed.';
  }
  return lines[detail] || 'Download failed. Partial file erased. Retry when the wires behave.';
}

function setupStateLine(status) {
  if (status.state === 'downloading') {
    const got = formatBytes(status.bytesReceived || 0);
    const total = formatBytes(status.totalBytes || status.defaultModel?.expectedBytes);
    return `Downloading: ${got} of ${total}. Kloppy is not frozen; he is simply acquiring mass.`;
  }
  if (status.state === 'verifying') {
    return 'Verifying SHA-256 before anything gets trusted. Kloppy distrusts mystery meat.';
  }
  if (status.state === 'ready') {
    return 'Local brain installed. The internet may now leave the building.';
  }
  if (status.state === 'failed') return setupFailureLine(status.detail);
  return 'No local brain configured yet. This is the tasteful part where we fix that.';
}

function updateSetupPanel(status = llmStatus) {
  const stateEl = document.getElementById('setup-state');
  if (!stateEl) return;

  const progress = document.getElementById('setup-progress');
  const downloadBtn = document.getElementById('setup-download');
  const cancelBtn = document.getElementById('setup-cancel');
  const pathSave = document.getElementById('setup-save-path');
  const busy = status.state === 'downloading' || status.state === 'verifying';
  const totalBytes = status.totalBytes || status.defaultModel?.expectedBytes || 1;
  const bytesReceived = status.bytesReceived || 0;

  stateEl.textContent = setupStateLine(status);
  if (progress) {
    progress.max = totalBytes;
    progress.value = status.state === 'verifying' ? totalBytes : Math.min(bytesReceived, totalBytes);
  }
  if (downloadBtn) downloadBtn.disabled = busy || status.state === 'ready';
  if (pathSave) pathSave.disabled = busy;
  if (cancelBtn) cancelBtn.classList.toggle('hidden', status.state !== 'downloading');
}

async function saveSetupModelPath() {
  const input = document.getElementById('setup-model-path');
  const modelPath = input.value.trim();
  if (!modelPath) {
    say('A blank path? That is more of a philosophical position than a brain.');
    setStatus('Model path required.');
    return;
  }

  const result = await window.kloppy.settings.update({ modelPath });
  if (!result.ok) {
    say('Kloppy rejected that path. He has standards, somehow.');
    setStatus('Could not save model path.');
    return;
  }

  currentSettings = result.settings;
  const statusResult = await window.kloppy.llm.status();
  llmStatus = statusResult.status;
  updateSetupPanel();
  say('Custom brain path saved. Kloppy will respect your local artifact.');
  setStatus('Local model path saved.');
}

async function openModelSetup() {
  setActiveButton('');
  panelTitle.textContent = 'SETUP.EXE';

  const infoResult = await window.kloppy.llm.setupInfo();
  const model = infoResult.defaultModel;
  const ramLine = model.ramWarning
    ? `<p class="setup-warning">RAM NOTICE: ${formatBytes(model.totalRamBytes)} detected. ${model.name} may be a squeeze; Kloppy will warn, not block.</p>`
    : '';

  panelBody.innerHTML = `
    <div class="setup-panel">
      <p><b>Set up your local AI</b></p>
      <p>Chat needs a llamafile. You can download Kloppy's pinned recommendation or point at one you already have.</p>
      ${ramLine}
      <div class="note setup-disclosure">
        <p><b>Download disclosure:</b> pressing Download makes exactly one external request:</p>
        <p class="setup-url">${model.url}</p>
        <p>It is stored in userData, verified with SHA-256, then used locally. No checksum, no brain.</p>
      </div>
      <ul class="setup-model-list">
        <li>Model: ${model.name}</li>
        <li>License: ${model.license}</li>
        <li>Size: about ${formatBytes(model.expectedBytes)}</li>
        <li>SHA-256: <span class="setup-hash">${model.sha256}</span></li>
      </ul>
      <div class="setup-actions">
        <button id="setup-download" type="button">Download recommended model</button>
        <button id="setup-already" type="button">I already have a llamafile</button>
        <button id="setup-cancel" class="hidden" type="button">Cancel download</button>
      </div>
      <progress id="setup-progress" value="0" max="${model.expectedBytes}"></progress>
      <p class="fine-print" id="setup-state"></p>
      <div class="setup-path hidden" id="setup-path">
        <label class="fake-option model-path-option">Local model path
          <input type="text" id="setup-model-path" placeholder="/path/to/model.llamafile">
          <span class="fine-print">Same setting as Settings. Paste a local llamafile path and Kloppy will stop asking.</span>
        </label>
        <button id="setup-save-path" type="button">Save path</button>
      </div>
    </div>`;

  document.getElementById('setup-download').addEventListener('click', async () => {
    say('You approved the one network trip. Kloppy packs a tiny checksum clipboard.');
    setStatus('Downloading recommended model. Bytes are happening.');
    updateSetupPanel({ ...llmStatus, state: 'downloading', bytesReceived: 0 });
    const result = await window.kloppy.llm.downloadDefault();
    await loadSettings();
    const statusResult = await window.kloppy.llm.status();
    llmStatus = statusResult.status;
    updateSetupPanel();
    if (result.ok) {
      say('Brain installed. Kloppy is now offline-capable and insufferable.');
      setStatus('Model ready. Chat works offline from here.');
    } else {
      say('The download failed. I cleaned up the partial file like a responsible nuisance.');
      setStatus('Model setup failed. Retry without restarting.');
    }
  });

  document.getElementById('setup-already').addEventListener('click', () => {
    const pathBox = document.getElementById('setup-path');
    pathBox.classList.remove('hidden');
    const input = document.getElementById('setup-model-path');
    input.value = currentSettings?.modelPath || '';
    input.focus();
  });

  document.getElementById('setup-save-path').addEventListener('click', saveSetupModelPath);
  document.getElementById('setup-model-path').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSetupModelPath();
  });
  document.getElementById('setup-cancel').addEventListener('click', async () => {
    await window.kloppy.llm.cancelDownload();
    say('Canceled. Partial file erased. We pretend this was always the plan.');
    setStatus('Download canceled.');
  });

  const statusResult = await window.kloppy.llm.status();
  llmStatus = statusResult.status;
  updateSetupPanel();
}

// ---- Chat panel (Kloppy's real brain: a local llamafile server) ----

// Transcript lives in renderer memory only — nothing is written to disk,
// and it vanishes when the app closes.
const chatMessages = [];

// One Kloppy-voiced line per brain state, shown at the top of the chat panel.
function brainNote() {
  if (llmStatus.state === 'not-configured') {
    return 'No brain installed yet. Use Setup to download the pinned llamafile or save a local path.';
  }
  if (llmStatus.state === 'downloading') {
    return setupStateLine(llmStatus);
  }
  if (llmStatus.state === 'verifying') {
    return 'Verifying the downloaded model before Kloppy is allowed to think with it.';
  }
  if (llmStatus.state === 'failed') {
    const reasons = {
      canceled: 'Model download canceled. Setup can retry without restarting.',
      'bad-checksum': 'Checksum mismatch. Setup cleaned up the file and will retry on command.',
      'settings-save-failed': 'The model verified, but settings refused to save the path.',
      'model-missing': 'That model path points at nothing. Fix it in Settings.',
      'spawn-failed': 'I could not run that file. Is it actually a llamafile?',
      crashed: 'My brain process crashed. Send a message to revive it.',
      'no-response': 'The model started but never woke up. Try again, or use a smaller model.',
      'no-port': 'No free localhost port found. Genuinely impressive.',
    };
    if (llmStatus.detail && llmStatus.detail.startsWith('http-')) {
      return 'Model download failed on the server side. Setup can retry.';
    }
    return reasons[llmStatus.detail] || 'Brain error. Send a message to retry.';
  }
  if (llmStatus.state === 'ready') {
    if (llmStatus.runtime === 'starting') {
      return 'Brain warming up. Large thoughts take a moment to load...';
    }
    if (llmStatus.runtime === 'online') {
      return 'Brain online. Running entirely on this machine.';
    }
    return 'Brain configured and asleep. It wakes up on your first message.';
  }
  return '';
}

function updateChatNote() {
  const note = document.getElementById('chat-note');
  if (note) note.textContent = brainNote(); // no-op unless chat panel is open
}

window.kloppy.llm.onStatus((status) => {
  llmStatus = status;
  updateChatNote();
  updateSetupPanel(status);
  if (status.state === 'downloading') {
    setStatus('Kloppy is downloading his recommended brain. You approved this trip.');
  } else if (status.state === 'verifying') {
    setStatus('Kloppy is checking the checksum. Suspicion is healthy.');
  } else if (status.state === 'ready' && status.runtime === 'starting') {
    setStatus('Kloppy is loading his brain. It is heavier than he expected.');
  } else if (status.state === 'ready' && status.runtime === 'online') {
    setStatus('Kloppy brain online. Locally. Obviously.');
  } else if (status.state === 'failed') {
    setStatus('Kloppy brain malfunction. He remains outwardly calm.');
  }
});

function appendChat(who, text) {
  chatMessages.push({ who, text });
  const log = document.getElementById('chat-log');
  if (!log) return; // chat panel not on screen; message is kept for later
  log.appendChild(chatLine({ who, text }));
  log.scrollTop = log.scrollHeight;
}

function chatLine(msg) {
  // Built with createElement + textContent so neither user input nor model
  // output is ever interpreted as HTML.
  const li = document.createElement('li');
  li.className = msg.who === 'you' ? 'note chat-line chat-you' : 'note chat-line';

  const whoEl = document.createElement('span');
  whoEl.className = 'chat-who';
  whoEl.textContent = msg.who === 'you' ? 'YOU>' : 'KLOPPY>';

  const textEl = document.createElement('span');
  textEl.textContent = ' ' + msg.text;

  li.append(whoEl, textEl);
  return li;
}

async function openChat() {
  panelTitle.textContent = 'CHAT.EXE';
  panelBody.innerHTML = `
    <p class="fine-print" id="chat-note"></p>
    <ul class="note-list chat-log" id="chat-log"></ul>
    <div class="note-editor">
      <textarea id="chat-input" rows="2" maxlength="2000"
        placeholder="Say something. A real model answers. From inside your computer."></textarea>
      <button id="chat-send" type="button">Send</button>
    </div>
    <p class="fine-print">Chat runs on your llamafile via localhost only. No cloud,
      no account, no history saved.</p>`;

  document.getElementById('chat-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  const log = document.getElementById('chat-log');
  for (const msg of chatMessages) log.appendChild(chatLine(msg));
  log.scrollTop = log.scrollHeight;

  const result = await window.kloppy.llm.status();
  llmStatus = result.status;
  updateChatNote();
}

// Maps llm:ask error shapes to things Kloppy would say instead of breaking.
const askErrorLines = {
  'not-configured':
    "I can't answer that: no brain configured. Run Setup or save a Local model path. Then we talk.",
  busy: 'Still chewing on your last message. One thought at a time.',
  empty: 'You have to type actual words. Any words.',
  'too-long': "That's a manifesto, not a message. Keep it under 2000 characters.",
  'request-failed': 'My brain produced static instead of words. Try again.',
  'bad-reply': 'My brain replied with pure nothing. Even I am unsettled. Try again.',
};

function startFailedLine(detail) {
  const lines = {
    'model-missing': 'That model path points at nothing. Settings has some explaining to do.',
    'spawn-failed': 'I could not execute that llamafile. Check the path and executable bit.',
    crashed: 'The model process exited during startup. Kloppy has filed a complaint with physics.',
    'no-response': 'The model started but never answered health checks. Try again, or use a smaller model.',
    'no-port': 'No free localhost port found. Impressive, but not helpful.',
  };
  return lines[detail] || 'I tried to wake my brain and it refused. Check the note above, then try again.';
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const text = input.value.trim();
  if (!text) {
    say('You have to say something first. That is how conversations work.');
    return;
  }

  const history = chatMessages.slice(-8);
  appendChat('you', text);
  input.value = '';
  sendBtn.disabled = true;
  say('Thinking. With my real brain. Listen to those fans.');
  setStatus('Kloppy is consulting the model. Locally. Menacingly.');

  const result = await window.kloppy.llm.ask(text, history);

  // The user may have switched panels while the model was thinking.
  const btnNow = document.getElementById('chat-send');
  if (btnNow) btnNow.disabled = false;

  if (!result.ok) {
    appendChat('kloppy', result.error === 'start-failed'
      ? startFailedLine(result.detail)
      : askErrorLines[result.error] || 'Something went wrong in there. Try again.');
    setStatus('Kloppy brain hiccup. No thoughts were harmed.');
    return;
  }

  appendChat('kloppy', result.reply);
  say('I said words. Real, locally-generated words.');
  setStatus('Kloppy answered with his own brain. A milestone.');
}

// ---- Folder watcher panel ----

const watcherComments = {
  added: 'A file appeared. Suspicious.',
  changed: 'Something changed. I am choosing to panic.',
  deleted: 'A file vanished. Classic.',
};

// Recent events live in the renderer only; nothing is written anywhere.
const watcherEvents = [];

window.kloppy.watcher.onEvent((evt) => {
  watcherEvents.unshift(evt);
  if (watcherEvents.length > 30) watcherEvents.pop();
  say(watcherComments[evt.type] ?? 'A file did something. Unclear what.');
  setStatus(`Kloppy witnessed: ${evt.file} ${evt.type}.`);
  refreshWatcherPanel(); // no-op unless the watcher panel is open
});

async function openWatcher() {
  panelTitle.textContent = 'WATCHER.SYS';
  panelBody.innerHTML = `
    <div class="note-editor">
      <button id="watch-choose" type="button">Choose folder to watch</button>
    </div>
    <p class="fine-print">Opt-in only. Kloppy sees file names and event types in
      folders you pick — never file contents. Nothing leaves this machine.</p>
    <h3 class="list-heading">WATCHED FOLDERS</h3>
    <ul class="note-list" id="watch-folders"></ul>
    <h3 class="list-heading">RECENT EVENTS</h3>
    <ul class="note-list" id="watch-events"></ul>`;

  document.getElementById('watch-choose').addEventListener('click', async () => {
    const result = await window.kloppy.watcher.choose();
    if (!result.ok) {
      if (result.error === 'canceled') {
        say('You opened the folder picker and chose... nothing. Iconic.');
        setStatus('Folder selection canceled.');
      } else if (result.error === 'already-watched') {
        say('I am already watching that one. Intensely.');
        setStatus('Folder is already being watched.');
      } else {
        say('That is not a watchable folder. Kloppy has limits.');
        setStatus('Could not watch that folder.');
      }
      return;
    }
    say('New folder acquired. I am watching it. Unblinking.');
    setStatus(`Kloppy now watches ${result.folders.length} folder(s).`);
    await refreshWatcherPanel();
  });

  await refreshWatcherPanel();
}

async function refreshWatcherPanel() {
  const foldersEl = document.getElementById('watch-folders');
  const eventsEl = document.getElementById('watch-events');
  if (!foldersEl) return; // watcher panel is not on screen right now

  const result = await window.kloppy.watcher.list();

  foldersEl.textContent = '';
  for (const dir of result.folders) {
    const li = document.createElement('li');
    li.className = 'note';
    const meta = document.createElement('div');
    meta.className = 'note-meta';
    const label = document.createElement('span');
    label.textContent = dir;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-delete';
    del.textContent = 'Unwatch';
    del.addEventListener('click', async () => {
      await window.kloppy.watcher.remove(dir);
      say('Fine. That folder is on its own now.');
      setStatus('Folder unwatched. Kloppy looks away.');
      await refreshWatcherPanel();
    });
    meta.append(label, del);
    li.appendChild(meta);
    foldersEl.appendChild(li);
  }
  if (foldersEl.children.length === 0) {
    emptyItem(foldersEl, 'Nothing watched. The files roam free.');
  }

  eventsEl.textContent = '';
  for (const evt of watcherEvents) {
    const li = document.createElement('li');
    li.className = 'note';
    li.textContent =
      `${new Date(evt.at).toLocaleTimeString()} — ${evt.file} ${evt.type} (${evt.dir})`;
    eventsEl.appendChild(li);
  }
  if (eventsEl.children.length === 0) {
    emptyItem(eventsEl, 'No events yet. Eerily quiet.');
  }
}

// ---- Actions panel (placeholders only — nothing executes) ----

async function openActions() {
  panelTitle.textContent = 'ACTIONS.BAT';
  panelBody.innerHTML = `
    <div class="note-editor action-form">
      <input id="action-name" type="text" placeholder="Action name">
      <input id="action-desc" type="text" placeholder="What it will someday do">
      <input id="action-cmd" type="text" placeholder="Command (decorative, not executed)">
      <button id="action-save" type="button">Save action</button>
    </div>
    <p class="fine-print">Actions are placeholders for future allowlisted automations.
      Command execution is <b>not implemented</b> — the text is stored, never run.</p>
    <h3 class="list-heading">SAVED ACTIONS</h3>
    <ul class="note-list" id="action-list"></ul>`;

  document.getElementById('action-save').addEventListener('click', saveAction);
  await refreshActions();
}

async function refreshActions() {
  const listEl = document.getElementById('action-list');
  if (!listEl) return;

  const result = await window.kloppy.actions.list();
  listEl.textContent = '';

  for (const action of result.actions) {
    const li = document.createElement('li');
    li.className = 'note';

    const text = document.createElement('p');
    text.className = 'note-text';
    text.textContent = action.description
      ? `${action.name} — ${action.description}`
      : action.name;

    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const cmd = document.createElement('span');
    cmd.textContent = action.command ? `$ ${action.command}` : '(no command text)';

    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'note-delete';
    run.textContent = 'Run';
    run.addEventListener('click', () => {
      // Deliberately does nothing. See the safety TODO in src/actions.js.
      say('Kloppy refuses to run this until you add a safety model.');
      setStatus('Action not executed. Kloppy values his warranty.');
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await window.kloppy.actions.remove(action.id);
      say('Action deleted before it could not-run even once.');
      setStatus('Action deleted.');
      await refreshActions();
    });

    meta.append(cmd, run, del);
    li.append(text, meta);
    listEl.appendChild(li);
  }

  if (listEl.children.length === 0) {
    emptyItem(listEl, 'No actions yet. Kloppy remains gloriously useless.');
  }
}

async function saveAction() {
  const name = document.getElementById('action-name');
  const desc = document.getElementById('action-desc');
  const cmd = document.getElementById('action-cmd');

  const result = await window.kloppy.actions.add(name.value, desc.value, cmd.value);
  if (!result.ok) {
    if (result.error === 'no-name') {
      say('An action with no name? That is how hauntings start. No.');
      setStatus('Actions need a name.');
    } else {
      say(`Keep it under ${result.max} characters. Kloppy has a small filing cabinet.`);
      setStatus('Action text too long.');
    }
    return;
  }

  name.value = '';
  desc.value = '';
  cmd.value = '';
  say('Action filed away. It will do nothing, beautifully.');
  setStatus('Action saved. Execution: still refused.');
  await refreshActions();
}

// ---- Cursed remarks (triggered from the tray menu) ----

const cursedLines = [
  'The cursor moves at night, even while you sleep.',
  'I counted your open tabs. All of them. I know.',
  'Something in your Downloads folder has been there since 2019. It waits.',
  'Ctrl+Z cannot undo what you did last Tuesday.',
  'Your recycle bin remembers everything you tried to forget.',
];

window.kloppy.onCursed(() => {
  const line = cursedLines[Math.floor(Math.random() * cursedLines.length)];
  say(line);
  setStatus('Kloppy said something cursed. You asked for this.');
});

async function boot() {
  await loadSettings();
  const statusResult = await window.kloppy.llm.status();
  llmStatus = statusResult.status;
  if (!currentSettings.modelPath && ['not-configured', 'failed'].includes(llmStatus.state)) {
    say('It looks like I arrived without a brain. Classic installer energy.');
    setStatus('First-run setup waiting for your explicit choice.');
    await openModelSetup();
  }
}

// ---- Wire up the buttons ----

let quipIndex = 0;

document.getElementById('btn-say').addEventListener('click', () => {
  quipIndex = (quipIndex + 1) % quips.length;
  say(quips[quipIndex]);
  setStatus(statusLines.say);
});

document.getElementById('btn-chat').addEventListener('click', async () => {
  const statusResult = await window.kloppy.llm.status();
  llmStatus = statusResult.status;
  if (!currentSettings?.modelPath && ['not-configured', 'failed', 'downloading', 'verifying'].includes(llmStatus.state)) {
    say('First we install the brain. Then we perform the miracle of conversation.');
    setStatus('Chat needs setup first.');
    await openModelSetup();
    return;
  }

  say('Fine. We can talk. I have a real brain now, you know.');
  setActiveButton('btn-chat');
  openChat();
});

document.getElementById('btn-notes').addEventListener('click', () => {
  say('Ah, the notes. I keep them in a jar.');
  setActiveButton('btn-notes');
  openNotes();
});

document.getElementById('btn-reminder').addEventListener('click', () => {
  say("Tell me what to yell about, and when.");
  setActiveButton('btn-reminder');
  openReminders();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  say('You can touch the settings now. Gently.');
  setStatus(statusLines.settings);
  setActiveButton('btn-settings');
  openSettings();
});

document.getElementById('btn-watcher').addEventListener('click', () => {
  say('Show me the folder. I will guard it with my life. Or at least glance at it.');
  setStatus('Kloppy is on watch duty.');
  setActiveButton('btn-watcher');
  openWatcher();
});

document.getElementById('btn-actions').addEventListener('click', () => {
  say('Behold: buttons that refuse to do things. Safety first.');
  setStatus('Kloppy opened the actions drawer.');
  setActiveButton('btn-actions');
  openActions();
});

document.getElementById('btn-summon').addEventListener('click', () => {
  window.kloppy.summon();
  say('Deploying a smaller me. This is fine.');
  setStatus('Kloppy has been summoned elsewhere.');
});

document.getElementById('btn-about').addEventListener('click', () => {
  say('That is me. That is my whole deal.');
  setStatus('Kloppy is feeling perceived.');
  setActiveButton('btn-about');
  showPanel('about');
});

boot();
