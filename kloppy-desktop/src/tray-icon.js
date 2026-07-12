// Kloppy's tray and window icon, drawn entirely in code with no image assets.
// The pixel art itself lives in tray-art.js so the app-icon generator can share
// it (see scripts/generate-icon.js) without duplicating the art.

const { nativeImage } = require('electron');
const { ART, PALETTE } = require('./tray-art');

function createTrayIcon() {
  const size = ART.length;
  if (!ART.every((row) => row.length === size)) {
    throw new Error('Tray icon art must be square.');
  }

  const buffer = Buffer.alloc(size * size * 4);

  ART.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const [r, g, b, a] = PALETTE[char];
      const offset = (y * size + x) * 4;
      // createFromBitmap expects BGRA byte order.
      buffer[offset] = b;
      buffer[offset + 1] = g;
      buffer[offset + 2] = r;
      buffer[offset + 3] = a;
    });
  });

  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}

module.exports = { createTrayIcon };
