'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const certificate = require('../../certificate');

test('sanitizes names without treating them as markup', () => {
  assert.equal(certificate.sanitizeName('  <b>Zoë</b>\u0000  O’Connor  '), 'Zoë O’Connor');
  assert.equal(certificate.sanitizeName('xX_Kloppy-Slayer_Xx'), 'xX_Kloppy-Slayer_Xx');
  assert.equal(certificate.sanitizeName('---'), '');
});

test('limits sanitized names to the certificate layout maximum', () => {
  const longName = 'A'.repeat(certificate.MAX_NAME_LENGTH + 10);
  assert.equal(certificate.sanitizeName(longName), 'A'.repeat(certificate.MAX_NAME_LENGTH));
});

test('creates a deterministic locally generated certificate number when entropy is supplied', () => {
  const number = certificate.createCertificateNumber({
    date: new Date('2026-07-13T12:00:00Z'),
    randomBytes: Uint8Array.from([0x12, 0xab, 0x00, 0xff]),
  });

  assert.equal(number, 'KF-20260713-12AB00FF');
});

test('creates the exact forgiveness message with the sanitized name', () => {
  assert.equal(
    certificate.forgivenessMessage('<i>Sam</i>'),
    'Kloppy has formally forgiven Sam for closing Microsoft Word without acknowledging his contribution.',
  );
});

test('creates a complete certificate without placing the name in share text', () => {
  const record = certificate.createCertificate('  Avery  ', {
    date: new Date('2026-07-13T12:00:00Z'),
    randomBytes: [1, 2, 3, 4],
  });

  assert.deepEqual(record, {
    name: 'Avery',
    number: 'KF-20260713-01020304',
    message: 'Kloppy has formally forgiven Avery for closing Microsoft Word without acknowledging his contribution.',
    shareText: 'I finally made things right with Kloppy. He has formally forgiven me for what happened in 2007.',
  });
  assert.equal(record.shareText.includes(record.name), false);
});

test('rejects a name that becomes empty after sanitization', () => {
  assert.throws(() => certificate.createCertificate('<script></script>'), /required/);
});
