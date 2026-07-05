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
  settings: {
    title: 'SETTINGS.INI',
    body: `
      <label class="fake-option"><input type="checkbox" checked disabled> Allow Kloppy to judge silently</label>
      <label class="fake-option"><input type="checkbox" checked disabled> Gremlin mode (cannot be disabled)</label>
      <label class="fake-option"><input type="checkbox" disabled> Respect user's time</label>
      <p class="fine-print">Settings are decorative. Kloppy does what Kloppy wants.</p>`,
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
  openNotes();
});

document.getElementById('btn-reminder').addEventListener('click', () => {
  say("Tell me what to yell about, and when.");
  openReminders();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  showPanel('settings');
  say('You can look at the settings. Looking is free.');
  setStatus(statusLines.settings);
});
