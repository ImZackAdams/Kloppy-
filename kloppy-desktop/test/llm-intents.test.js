'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const llm = require('../src/llm');

function initHarness() {
  const state = {
    userName: '',
    notes: [],
    reminders: [],
    memories: [],
    nextNoteId: 1,
    nextReminderId: 1,
  };

  llm.init({
    getModelPath: () => '',
    getSetupStatus: () => null,
    getAssistantContext: () => ({
      profile: { userName: state.userName },
      notes: state.notes,
      reminders: state.reminders,
      memories: state.memories,
      watchedFolders: [],
      actions: [],
    }),
    localActions: {
      setUserName: (userName) => {
        state.userName = userName;
        return { ok: true, settings: { userName } };
      },
      addNote: (text) => {
        const note = {
          id: `note-${state.nextNoteId++}`,
          text: String(text).trim(),
          createdAt: new Date().toISOString(),
        };
        state.notes.unshift(note);
        return { ok: true, note };
      },
      addReminder: (text, dueAt) => {
        const reminder = {
          id: `reminder-${state.nextReminderId++}`,
          text: String(text).trim(),
          dueAt,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        state.reminders.push(reminder);
        return { ok: true, reminder };
      },
    },
    broadcast: () => {},
  });

  return state;
}

test('answers current year as a local intent', async () => {
  initHarness();

  const result = await llm.ask('what year is it?');

  assert.equal(result.ok, true);
  assert.equal(result.local, true);
  assert.match(result.reply, new RegExp(`\\b${new Date().getFullYear()}\\b`));
});

test('stores and recalls the local user name', async () => {
  const state = initHarness();

  const saved = await llm.ask('my name is Zack');
  const recalled = await llm.ask('what is my name?');

  assert.equal(saved.ok, true);
  assert.equal(saved.local, true);
  assert.equal(state.userName, 'Zack');
  assert.match(saved.reply, /Zack/);
  assert.match(recalled.reply, /Your name is Zack/);
});

test('creates and lists notes locally', async () => {
  const state = initHarness();

  const saved = await llm.ask('make a note: buy milk');
  const listed = await llm.ask('what notes do I have?');

  assert.equal(saved.ok, true);
  assert.equal(saved.local, true);
  assert.equal(state.notes.length, 1);
  assert.equal(state.notes[0].text, 'buy milk');
  assert.match(listed.reply, /buy milk/);
});

test('creates and lists reminders locally', async () => {
  const state = initHarness();

  const saved = await llm.ask('remind me to stretch in 10 minutes');
  const listed = await llm.ask('list my reminders');

  assert.equal(saved.ok, true);
  assert.equal(saved.local, true);
  assert.equal(state.reminders.length, 1);
  assert.equal(state.reminders[0].text, 'stretch');
  assert.doesNotThrow(() => new Date(state.reminders[0].dueAt).toISOString());
  assert.match(listed.reply, /stretch/);
});

test('cancels a pending local action', async () => {
  const state = initHarness();

  const pending = await llm.ask('make a note');
  const canceled = await llm.ask('cancel');
  const listed = await llm.ask('list my notes');

  assert.equal(pending.ok, true);
  assert.match(pending.reply, /What should the note say/);
  assert.equal(canceled.ok, true);
  assert.match(canceled.reply, /Canceled/);
  assert.equal(state.notes.length, 0);
  assert.match(listed.reply, /no notes/i);
});

test('system prompt includes only enabled local memories', () => {
  const state = initHarness();
  state.memories = [
    {
      id: 'mem_1',
      text: 'The user prefers concise answers.',
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'mem_2',
      text: 'Disabled memory should stay private.',
      enabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const prompt = llm.buildSystemPrompt('how should you answer?');

  assert.match(prompt, /Local user memories:/);
  assert.match(prompt, /- The user prefers concise answers\./);
  assert.doesNotMatch(prompt, /Disabled memory should stay private/);
});
