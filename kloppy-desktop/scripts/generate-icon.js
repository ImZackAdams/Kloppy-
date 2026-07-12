// Generates build/icon.png, the square master icon electron-builder uses to
// derive the packaged app's icons (.icns / .ico / Linux png set).
//
// It renders the shared tray pixel art (src/tray-art.js) at a large size using
// crisp nearest-neighbor scaling and encodes a PNG with only Node built-ins
// (zlib), so there are no extra npm dependencies.
//
// Usage: node scripts/generate-icon.js   (or: npm run icon:generate)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ART, PALETTE } = require('../src/tray-art');

const SCALE = 32; // 32x32 art -> 1024x1024 master icon
const SRC = ART.length;
const SIZE = SRC * SCALE;

function assertSquareArt() {
  if (!ART.every((row) => row.length === SRC)) {
    throw new Error('Icon art must be square.');
  }
}

// PNG chunk CRC-32 (polynomial 0xEDB88320), table-based.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function renderPng() {
  assertSquareArt();

  const rowBytes = SIZE * 4; // RGBA
  // Raw image = one filter byte (0 = none) per scanline + pixel data.
  const raw = Buffer.alloc((rowBytes + 1) * SIZE);
  let pos = 0;

  ART.forEach((row) => {
    // Build one horizontally-scaled RGBA scanline for this art row...
    const scanline = Buffer.alloc(rowBytes);
    let s = 0;
    [...row].forEach((char) => {
      const [r, g, b, a] = PALETTE[char];
      for (let k = 0; k < SCALE; k += 1) {
        scanline[s] = r;
        scanline[s + 1] = g;
        scanline[s + 2] = b;
        scanline[s + 3] = a;
        s += 4;
      }
    });
    // ...then repeat it SCALE times vertically (nearest-neighbor).
    for (let k = 0; k < SCALE; k += 1) {
      raw[pos] = 0; // filter type: none
      pos += 1;
      scanline.copy(raw, pos);
      pos += rowBytes;
    }
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); // width
  ihdr.writeUInt32BE(SIZE, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const outDir = path.join(__dirname, '..', 'build');
  const outFile = path.join(outDir, 'icon.png');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, renderPng());
  process.stdout.write(`Wrote ${outFile} (${SIZE}x${SIZE})\n`);
}

main();
