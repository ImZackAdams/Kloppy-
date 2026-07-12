// Kloppy's icon pixel art, kept dependency-free so it can be shared by both the
// Electron tray/window icon (tray-icon.js) and the standalone app-icon
// generator (scripts/generate-icon.js) without duplicating the art.
// A tiny pixel art version of the whitepaper paperclip mascot with the fund cup.

// One character per pixel:
//   .  transparent      K  black outline      S  silver wire
//   Y  sticky note      C  fund cup           L  cup label
const ART = [
  '................................',
  '................................',
  '...........KKKKKK...............',
  '.........KKSSSSSSKK.............',
  '........KSS......SSK............',
  '.......KSS........SSK...........',
  '.......KSS........SSK...........',
  '.......KSS..KKKKKKKKKK..........',
  '.......KSS.KYYYYYYYYYYK.........',
  '.......KSS.KYYKKYYKKYYK.........',
  '.......KSS.KYYKKYYKKYYK.........',
  '.......KSS.KYYYYYYYYYYK.........',
  '.......KSS.KYYYKKKKYYYK.........',
  '.......KSS.KYYYYYYYYYYK.........',
  '.......KSS..KKKKKKKKKK..........',
  '.......KSS........SSK...........',
  '.......KSS........SSK...........',
  '.......KSS........SSK...KKKK....',
  '.......KSS........SSK..KCCCCK...',
  '.......KSS..KKKK..SSK..KCLLK....',
  '.......KSS.KSSSSK.SSK..KCCCCK...',
  '.......KSS.KSSSSK.SSK...KKKK....',
  '.......KSS.KSSSSK.SSK...........',
  '.......KSS..KKKK..SSK...........',
  '.......KSS........SSK...........',
  '........KSS......SSK............',
  '.........KSS....SSK.............',
  '..........KSSSSSSK..............',
  '...........KKKKKK...............',
  '................................',
  '................................',
  '................................',
];

// [red, green, blue, alpha] per palette character
const PALETTE = {
  '.': [0, 0, 0, 0],
  K: [0, 0, 0, 255],
  S: [198, 205, 210, 255],
  Y: [246, 226, 162, 255],
  C: [205, 233, 255, 180],
  L: [245, 237, 210, 255],
};

module.exports = { ART, PALETTE };
