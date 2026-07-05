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
      </ul>
      <p class="fine-print">Kloppy cannot phone home. Kloppy does not know what home is.</p>`,
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
    <p class="fine-print">Saved instantly to settings.json. Kloppy pretends not to care.</p>`;

  const launchMin = document.getElementById('set-launch-min');
  const commentary = document.getElementById('set-commentary');
  const frequency = document.getElementById('set-frequency');
  const theme = document.getElementById('set-theme');

  launchMin.checked = s.launchMinimized;
  commentary.checked = s.randomCommentary;
  frequency.value = s.commentaryFrequency;
  theme.value = s.theme;

  launchMin.addEventListener('change', () => saveSetting('launchMinimized', launchMin.checked));
  commentary.addEventListener('change', () => saveSetting('randomCommentary', commentary.checked));
  frequency.addEventListener('change', () => saveSetting('commentaryFrequency', frequency.value));
  theme.addEventListener('change', () => saveSetting('theme', theme.value));
}

async function loadSettings() {
  const result = await window.kloppy.settings.get();
  currentSettings = result.settings;
  applyTheme(currentSettings.theme);
  setupCommentary();
}

loadSettings();

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

// ---- Wire up the buttons ----

let quipIndex = 0;

document.getElementById('btn-say').addEventListener('click', () => {
  quipIndex = (quipIndex + 1) % quips.length;
  say(quips[quipIndex]);
  setStatus(statusLines.say);
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
