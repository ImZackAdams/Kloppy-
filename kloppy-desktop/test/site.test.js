'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const homepagePath = path.join(root, 'index.html');
const whitepaperPath = path.join(root, 'whitepaper.html');
const homepage = fs.readFileSync(homepagePath, 'utf8');
const whitepaper = fs.readFileSync(whitepaperPath, 'utf8');

function idsIn(html) {
  return new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]));
}

function localHrefsIn(html) {
  return Array.from(html.matchAll(/\shref="([^"]+)"/g), (match) => match[1])
    .filter((href) => !/^(?:https?:|mailto:)/.test(href));
}

function assertLocalLinksResolve(filePath, html) {
  const sourceIds = idsIn(html);

  localHrefsIn(html).forEach((href) => {
    const [relativeFile, hash = ''] = href.split('#');
    const targetPath = relativeFile
      ? path.resolve(path.dirname(filePath), relativeFile)
      : filePath;

    assert.equal(fs.existsSync(targetPath), true, `${href} should resolve from ${path.basename(filePath)}`);

    if (!hash) return;

    const targetIds = targetPath === filePath
      ? sourceIds
      : idsIn(fs.readFileSync(targetPath, 'utf8'));
    assert.equal(targetIds.has(decodeURIComponent(hash)), true, `${href} should reference an existing id`);
  });
}

test('homepage has complete launch metadata and branded image assets', () => {
  assert.match(
    homepage,
    /<meta name="description" content="Kloppy is a local first desktop gremlin for notes, reminders, AI chat, and folder commentary\./,
  );
  assert.match(homepage, /<title>Kloppy: Local First Notes, Reminders &amp; AI Chat<\/title>/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/getkloppy\.com\/">/);
  assert.match(homepage, /<meta property="og:image" content="https:\/\/getkloppy\.com\/assets\/kloppy-social\.png">/);
  assert.match(homepage, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(homepage, /<meta property="og:image:alt" content="[^"]+">/);
  assert.match(homepage, /<link rel="icon" href="assets\/favicon\.svg" type="image\/svg\+xml">/);

  const social = fs.readFileSync(path.join(root, 'assets', 'kloppy-social.png'));
  assert.deepEqual(Array.from(social.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(social.readUInt32BE(16), 1200);
  assert.equal(social.readUInt32BE(20), 630);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'favicon.svg')), true);
});

test('homepage sections follow the launch order and qualify the 69-commit history', () => {
  const orderedIds = ['top', 'download', 'demo', 'about', 'features', 'lore', 'forgiveness', 'pricing', 'faq'];
  let previous = -1;

  orderedIds.forEach((id) => {
    const position = homepage.indexOf(`id="${id}"`);
    assert.ok(position > previous, `${id} should appear after the preceding launch section`);
    previous = position;
  });

  assert.match(homepage, /original app-and-launch state was completed at exactly 69 commits/i);
  assert.match(homepage, /historical claim refers to the original Kloppy v0\.1\.0 app-and-launch state/i);
  assert.doesNotMatch(homepage, /Commit 70 was demanded by management/);
});

test('homepage release data matches the published v0.1.0 artifacts', () => {
  const expected = new Map([
    ['Kloppy-0.1.0-win-x64.exe', '16d44d8de0866498c908f5da842b1535f2a58a985a667197a569e5ab165d773a'],
    ['Kloppy-0.1.0-mac-universal.dmg', '1574ed9416520d2623b32852fafe95401754c55dbbb39301e50e1c5d78d635b9'],
    ['Kloppy-0.1.0-linux-x86_64.AppImage', '5f9ad00999ed5d02e62ffe39a28c4194dad156d1d085c6784299d0b61197e9b0'],
    ['Kloppy-0.1.0-linux-amd64.deb', '2ce4cc3f4221b91458f33a2f814939ec00434334842e00ed14ad9793a77e8a1b'],
  ]);

  assert.equal(
    homepage.split('https://github.com/ImZackAdams/Kloppy/releases/tag/v0.1.0').length - 1,
    1,
    'the release URL should have one source of truth',
  );
  assert.equal(homepage.split('https://buy.stripe.com/00w14mbeZ8XWa2K8CHdQQ00').length - 1, 1);

  expected.forEach((checksum, artifact) => {
    assert.match(homepage, new RegExp(artifact.replaceAll('.', '\\.'), 'g'));
    assert.match(homepage, new RegExp(checksum));
  });

  assert.doesNotMatch(homepage, /Kloppy-0\.1\.0-(?:win-arm|linux-arm)/i);
});

test('static site local links, new-window links, and text alternatives are valid', () => {
  assertLocalLinksResolve(homepagePath, homepage);
  assertLocalLinksResolve(whitepaperPath, whitepaper);

  [homepage, whitepaper].forEach((html) => {
    const newWindowLinks = Array.from(html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g), (match) => match[0]);
    newWindowLinks.forEach((tag) => assert.match(tag, /rel="[^"]*noopener[^"]*"/));
    assert.doesNotMatch(html, /<img\b(?![^>]*\balt=)[^>]*>/i);
  });
});

test('white paper metadata and shipped-product privacy copy are current', () => {
  assert.match(whitepaper, /<link rel="canonical" href="https:\/\/getkloppy\.com\/whitepaper\.html">/);
  assert.match(whitepaper, /<meta property="og:image" content="https:\/\/getkloppy\.com\/assets\/kloppy-social\.png">/);
  assert.match(whitepaper, /The only external app request is the optional model download/);
  assert.match(whitepaper, /v0\.1\.0 supports a local llamafile only/);
  assert.match(whitepaper, /href="index\.html#download">Download Kloppy/);
});
