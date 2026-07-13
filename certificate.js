(function attachCertificateLogic(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.KloppyCertificate = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function certificateFactory() {
  'use strict';

  const MAX_NAME_LENGTH = 32;
  const SHARE_TEXT = 'I finally made things right with Kloppy. He has formally forgiven me for what happened in 2007.';

  function sanitizeName(value) {
    const normalized = String(value ?? '')
      .normalize('NFKC')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
      .replace(/[^\p{L}\p{M}\p{N} _.'’\-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[ _.'’\-]+|[ _.'’\-]+$/g, '');

    const shortened = Array.from(normalized).slice(0, MAX_NAME_LENGTH).join('').trim();
    return /[\p{L}\p{N}]/u.test(shortened) ? shortened : '';
  }

  function localRandomBytes(length) {
    const bytes = new Uint8Array(length);
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;

    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      return cryptoApi.getRandomValues(bytes);
    }

    for (let index = 0; index < length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  function createCertificateNumber(options = {}) {
    const date = options.date instanceof Date ? options.date : new Date();
    if (Number.isNaN(date.getTime())) throw new TypeError('A valid date is required.');

    const suppliedBytes = typeof options.randomBytes === 'function'
      ? options.randomBytes(4)
      : options.randomBytes;
    const bytes = suppliedBytes ? Uint8Array.from(suppliedBytes) : localRandomBytes(4);
    if (bytes.length < 4) throw new TypeError('Four random bytes are required.');

    const dateStamp = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('');
    const randomPart = Array.from(bytes.slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

    return `KF-${dateStamp}-${randomPart}`;
  }

  function forgivenessMessage(name) {
    const safeName = sanitizeName(name);
    if (!safeName) throw new TypeError('A first name or nickname is required.');
    return `Kloppy has formally forgiven ${safeName} for closing Microsoft Word without acknowledging his contribution.`;
  }

  function createCertificate(name, options = {}) {
    const safeName = sanitizeName(name);
    if (!safeName) throw new TypeError('A first name or nickname is required.');

    return Object.freeze({
      name: safeName,
      number: createCertificateNumber(options),
      message: forgivenessMessage(safeName),
      shareText: SHARE_TEXT,
    });
  }

  return Object.freeze({
    MAX_NAME_LENGTH,
    SHARE_TEXT,
    sanitizeName,
    createCertificateNumber,
    forgivenessMessage,
    createCertificate,
  });
});
