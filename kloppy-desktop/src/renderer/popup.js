// Kloppy summon-popup logic.
// The main process sends the message; the dismiss button closes the window.

window.kloppy.onPopupMessage((text) => {
  document.getElementById('bubble-text').textContent = text;
});

document.getElementById('dismiss').addEventListener('click', () => {
  window.close();
});
