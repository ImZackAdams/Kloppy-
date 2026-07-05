// First-run local model setup (main process only).
// The only external network request Kloppy can make lives here, and it only
// starts after the user presses the explicit download button in the renderer.

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const GIB = 1024 * 1024 * 1024;

const DEFAULT_MODEL = Object.freeze({
  id: 'qwen3.5-0.8b-q8_0-llamafile-v0.10.3',
  name: 'Qwen3.5 0.8B Q8_0',
  fileName: 'Qwen3.5-0.8B-Q8_0.llamafile',
  url:
    'https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/' +
    'ce2b08f53ee7368ec51784e5325faad6f2677ecb/Qwen3.5-0.8B-Q8_0.llamafile',
  sha256: '052d8c0d6ef9809b3ba0de6bbdbdc92864a9411b13ef76bb974d7e42e00ab6d1',
  expectedBytes: 1.34 * GIB,
  license: 'Apache-2.0',
  release: 'mozilla-ai/llamafile_0.10 @ ce2b08f (llamafile v0.10.3)',
  recommendedRamBytes: 4 * GIB,
});

let userDataDir = null;
let getModelPath = null;
let saveModelPath = null;
let onStatusChanged = null;
let active = null;
let setupStatus = { state: 'not-configured', detail: '' };

function init(options) {
  userDataDir = options.userDataDir;
  getModelPath = options.getModelPath;
  saveModelPath = options.saveModelPath;
  onStatusChanged = options.onStatusChanged;
}

function defaultModelsDir() {
  return path.join(userDataDir, 'models');
}

function defaultFileName() {
  return process.platform === 'win32'
    ? `${DEFAULT_MODEL.fileName}.exe`
    : DEFAULT_MODEL.fileName;
}

function defaultModelPath() {
  return path.join(defaultModelsDir(), defaultFileName());
}

function tempPath() {
  return path.join(defaultModelsDir(), `${defaultFileName()}.download`);
}

function publicModelInfo() {
  const totalRamBytes = os.totalmem();
  return {
    id: DEFAULT_MODEL.id,
    name: DEFAULT_MODEL.name,
    fileName: defaultFileName(),
    url: DEFAULT_MODEL.url,
    sha256: DEFAULT_MODEL.sha256,
    expectedBytes: DEFAULT_MODEL.expectedBytes,
    license: DEFAULT_MODEL.license,
    release: DEFAULT_MODEL.release,
    recommendedRamBytes: DEFAULT_MODEL.recommendedRamBytes,
    installPath: defaultModelPath(),
    totalRamBytes,
    ramWarning: totalRamBytes < DEFAULT_MODEL.recommendedRamBytes,
  };
}

function withInfo(status) {
  return {
    ...status,
    defaultModel: publicModelInfo(),
  };
}

function notify() {
  if (onStatusChanged) onStatusChanged();
}

function setSetupStatus(next) {
  setupStatus = next;
  notify();
}

function clearFailure() {
  if (setupStatus.state === 'failed') {
    setupStatus = { state: getModelPath() ? 'ready' : 'not-configured', detail: '' };
    notify();
  }
}

function getStatusForLlm() {
  if (active || setupStatus.state === 'downloading' || setupStatus.state === 'verifying') {
    return withInfo(setupStatus);
  }
  if (setupStatus.state === 'failed' && !getModelPath()) {
    return withInfo(setupStatus);
  }
  if (!getModelPath()) {
    return withInfo({ state: 'not-configured', detail: '' });
  }
  return null;
}

function getInfo() {
  return { ok: true, defaultModel: publicModelInfo() };
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best effort cleanup only.
  }
}

function ensureModelDir() {
  fs.mkdirSync(defaultModelsDir(), { recursive: true });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifyFile(filePath) {
  const actual = await sha256File(filePath);
  return actual === DEFAULT_MODEL.sha256;
}

function finishInstall(fromPath) {
  const finalPath = defaultModelPath();
  safeUnlink(finalPath);
  fs.renameSync(fromPath, finalPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(finalPath, 0o755);
  }
  const result = saveModelPath(finalPath);
  if (!result.ok) {
    safeUnlink(finalPath);
    throw new Error('settings-save-failed');
  }
  setupStatus = { state: 'ready', detail: '' };
  notify();
  return { ok: true, path: finalPath, reused: false };
}

async function useExistingDefaultIfValid() {
  const finalPath = defaultModelPath();
  if (!fs.existsSync(finalPath)) return null;

  setSetupStatus({
    state: 'verifying',
    detail: 'existing',
    bytesReceived: 0,
    totalBytes: DEFAULT_MODEL.expectedBytes,
  });

  const valid = await verifyFile(finalPath);
  if (!valid) {
    safeUnlink(finalPath);
    return null;
  }

  const result = saveModelPath(finalPath);
  if (!result.ok) throw new Error('settings-save-failed');
  setupStatus = { state: 'ready', detail: '' };
  notify();
  return { ok: true, path: finalPath, reused: true };
}

function downloadToFile(url, outPath, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirectsRemaining <= 0 || !response.headers.location) {
          reject(new Error('redirect-failed'));
          return;
        }
        const nextUrl = new URL(response.headers.location, url);
        if (nextUrl.protocol !== 'https:') {
          reject(new Error('bad-redirect'));
          return;
        }
        downloadToFile(nextUrl.toString(), outPath, redirectsRemaining - 1)
          .then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`http-${response.statusCode}`));
        return;
      }

      const contentLength = Number(response.headers['content-length']);
      const totalBytes = Number.isFinite(contentLength) && contentLength > 0
        ? contentLength
        : DEFAULT_MODEL.expectedBytes;
      let bytesReceived = 0;
      const file = fs.createWriteStream(outPath, { mode: 0o600 });

      active.response = response;
      active.file = file;

      response.on('data', (chunk) => {
        bytesReceived += chunk.length;
        setSetupStatus({
          state: 'downloading',
          detail: '',
          bytesReceived,
          totalBytes,
        });
      });

      response.on('error', reject);
      file.on('error', reject);
      file.on('finish', () => resolve({ bytesReceived, totalBytes }));

      response.pipe(file);
    });

    active.request = request;
    request.on('error', reject);
  });
}

async function downloadDefault() {
  if (active) return { ok: false, error: 'busy' };
  if (getModelPath()) return { ok: true, path: getModelPath(), skipped: true };

  ensureModelDir();
  const stagedPath = tempPath();
  safeUnlink(stagedPath);

  let existing;
  try {
    existing = await useExistingDefaultIfValid();
  } catch (error) {
    setSetupStatus({ state: 'failed', detail: error.message });
    return { ok: false, error: error.message };
  }
  if (existing) return existing;

  active = { request: null, response: null, file: null, canceled: false };
  setSetupStatus({
    state: 'downloading',
    detail: '',
    bytesReceived: 0,
    totalBytes: DEFAULT_MODEL.expectedBytes,
  });

  try {
    const downloaded = await downloadToFile(DEFAULT_MODEL.url, stagedPath);
    if (active.canceled) throw new Error('canceled');

    setSetupStatus({
      state: 'verifying',
      detail: '',
      bytesReceived: downloaded.bytesReceived,
      totalBytes: downloaded.totalBytes,
    });

    const valid = await verifyFile(stagedPath);
    if (!valid) throw new Error('bad-checksum');

    active = null;
    return finishInstall(stagedPath);
  } catch (error) {
    const detail = active && active.canceled ? 'canceled' : error.message;
    active = null;
    safeUnlink(stagedPath);
    setSetupStatus({ state: 'failed', detail });
    return { ok: false, error: detail };
  }
}

function cancelDownload() {
  if (!active) return { ok: false, error: 'not-downloading' };
  active.canceled = true;
  if (active.response) active.response.destroy(new Error('canceled'));
  if (active.request) active.request.destroy(new Error('canceled'));
  if (active.file) active.file.destroy(new Error('canceled'));
  safeUnlink(tempPath());
  return { ok: true };
}

module.exports = {
  init,
  getInfo,
  getStatusForLlm,
  downloadDefault,
  cancelDownload,
  clearFailure,
};
