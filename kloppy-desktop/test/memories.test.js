'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const memories = require('../src/memories');

function tempUserData(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kloppy-memories-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('adds, lists, and persists memories newest first', (t) => {
  const dir = tempUserData(t);
  memories.init(dir);

  assert.deepEqual(memories.list(), { ok: true, memories: [] });

  const first = memories.add('  likes concise answers  ');
  const second = memories.add('prefers sarcastic but useful responses');

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.match(first.memory.id, /^mem_/);
  assert.equal(first.memory.text, 'likes concise answers');
  assert.equal(first.memory.enabled, true);
  assert.doesNotThrow(() => new Date(first.memory.createdAt).toISOString());

  assert.deepEqual(memories.list().memories.map((memory) => memory.text), [
    'prefers sarcastic but useful responses',
    'likes concise answers',
  ]);

  memories.init(dir);
  assert.deepEqual(memories.list().memories.map((memory) => memory.text), [
    'prefers sarcastic but useful responses',
    'likes concise answers',
  ]);
});

test('edits, disables, enables, deletes, and deletes all memories', (t) => {
  memories.init(tempUserData(t));

  const first = memories.add('old wording').memory;
  const second = memories.add('keep me').memory;

  const edited = memories.update(first.id, 'new wording');
  assert.equal(edited.ok, true);
  assert.equal(edited.memory.text, 'new wording');
  assert.equal(memories.list().memories.find((memory) => memory.id === first.id).text, 'new wording');

  assert.deepEqual(memories.setEnabled(first.id, 'nope'), { ok: false, error: 'invalid' });
  const disabled = memories.setEnabled(first.id, false);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.memory.enabled, false);
  assert.deepEqual(memories.enabled().memories.map((memory) => memory.text), ['keep me']);

  const enabled = memories.setEnabled(first.id, true);
  assert.equal(enabled.ok, true);
  assert.equal(enabled.memory.enabled, true);

  assert.deepEqual(memories.remove('mem_missing'), { ok: false, error: 'not-found' });
  assert.deepEqual(memories.remove(second.id), { ok: true });
  assert.deepEqual(memories.list().memories.map((memory) => memory.text), ['new wording']);

  assert.deepEqual(memories.removeAll(), { ok: true });
  assert.deepEqual(memories.list(), { ok: true, memories: [] });
});

test('rejects empty and oversized memory text', (t) => {
  memories.init(tempUserData(t));

  assert.deepEqual(memories.add('   '), { ok: false, error: 'empty' });
  assert.deepEqual(memories.update('mem_nope', ''), { ok: false, error: 'empty' });
  assert.deepEqual(memories.add('x'.repeat(memories.MAX_MEMORY_LENGTH + 1)), {
    ok: false,
    error: 'too-long',
    max: memories.MAX_MEMORY_LENGTH,
  });
  assert.deepEqual(memories.update('mem_nope', 'x'.repeat(memories.MAX_MEMORY_LENGTH + 1)), {
    ok: false,
    error: 'too-long',
    max: memories.MAX_MEMORY_LENGTH,
  });
  assert.deepEqual(memories.list(), { ok: true, memories: [] });
});

test('deduplicates exact memory text on add and update', (t) => {
  memories.init(tempUserData(t));

  const first = memories.add('same thought');
  const duplicate = memories.add('same thought');

  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.memory.id, first.memory.id);
  assert.equal(memories.list().memories.length, 1);

  const other = memories.add('different thought').memory;
  const collapsed = memories.update(other.id, 'same thought');
  assert.equal(collapsed.ok, true);
  assert.equal(collapsed.duplicate, true);
  assert.deepEqual(memories.list().memories.map((memory) => memory.text), ['same thought']);
});

test('preserves disabled memories but excludes them from enabled output', (t) => {
  memories.init(tempUserData(t));

  const memory = memories.add('do not send while disabled').memory;
  memories.setEnabled(memory.id, false);

  assert.deepEqual(memories.list().memories.map((item) => item.text), [
    'do not send while disabled',
  ]);
  assert.deepEqual(memories.enabled(), { ok: true, memories: [] });
});

test('corrupted storage and invalid entries do not crash', (t) => {
  const dir = tempUserData(t);
  fs.writeFileSync(path.join(dir, 'memories.json'), 'not json');
  fs.writeFileSync(path.join(dir, 'memories.json.bak'), 'also bad');
  memories.init(dir);

  assert.deepEqual(memories.list(), { ok: true, memories: [] });

  const valid = {
    id: 'mem_good',
    text: 'still valid',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  fs.writeFileSync(path.join(dir, 'memories.json'), JSON.stringify({
    memories: [
      valid,
      { ...valid, id: 'mem_duplicate' },
      { id: 'bad-prefix', text: 'nope', enabled: true, createdAt: valid.createdAt, updatedAt: valid.updatedAt },
      { id: 'mem_bad_text', text: '', enabled: true, createdAt: valid.createdAt, updatedAt: valid.updatedAt },
      { id: 'mem_bad_enabled', text: 'nope', enabled: 'yes', createdAt: valid.createdAt, updatedAt: valid.updatedAt },
      null,
    ],
  }));

  assert.deepEqual(memories.list().memories.map((memory) => memory.text), ['still valid']);
});
