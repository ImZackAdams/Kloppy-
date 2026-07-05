// Kloppy's tray icon, drawn entirely in code — no image assets.
// A 16x16 pixel-art version of the gremlin monitor face.

const { nativeImage } = require('electron');

// One character per pixel:
//   .  transparent      C  gray chassis      D  dark screen
//   E  phosphor glow    b  dark gray (stems/legs)
const ART = [
  '................',
  '..E..........E..',
  '...b........b...',
  '.CCCCCCCCCCCCCC.',
  '.CDDDDDDDDDDDDC.',
  '.CDEEDDDDDDEEDC.',
  '.CDEEDDDDDDEEDC.',
  '.CDDDDDDDDDDDDC.',
  '.CDEDEDEDEDEDDC.',
  '.CDDDDDDDDDDDDC.',
  '.CCCCCCCCCCCCCC.',
  '....b......b....',
  '....b......b....',
  '...bb......bb...',
  '................',
  '................',
];

// [red, green, blue, alpha] per palette character
const PALETTE = {
  '.': [0, 0, 0, 0],
  C: [198, 198, 198, 255],
  D: [12, 58, 18, 255],
  E: [130, 240, 120, 255],
  b: [80, 80, 80, 255],
};

function createTrayIcon() {
  const size = 16;
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
