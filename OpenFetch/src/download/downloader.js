'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { DEFAULTS } = require('../config/defaults');
const { OpenFetchError } = require('../utils/errors');
const { sanitizeFilename, resolveInside } = require('../utils/filename');

const MAX_REDIRECTS = 5;

const FILESYSTEM_REASONS = {
  EACCES: 'permission denied',
  EPERM: 'permission denied',
  EROFS: 'the file system is read-only',
  ENOSPC: 'there is no space left on the device',
  ENOENT: 'the path does not exist',
  ENOTDIR: 'a part of the path is not a directory',
};

function filesystemError(error, target) {
  const reason = FILESYSTEM_REASONS[error.code] || error.code || error.message;
  return new OpenFetchError(`Cannot write to '${target}': ${reason}.`, {
    code: 'FILESYSTEM',
    suggestion: 'Choose a different output directory with --output or check its permissions.',
    cause: error,
  });
}

/** Only HTTPS URLs on GitHub's own hosts are allowed. The URL itself is never echoed (it may be signed). */
function assertAllowedUrl(urlString, allowedHosts) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new OpenFetchError('The download URL is invalid.', { code: 'URL_NOT_ALLOWED' });
  }
  const allowed =
    url.protocol === 'https:' &&
    allowedHosts.includes(url.hostname) &&
    (url.port === '' || url.port === '443') &&
    url.username === '' &&
    url.password === '';
  if (!allowed) {
    throw new OpenFetchError(`Refusing to download from '${url.hostname || 'an unknown host'}'.`, {
      code: 'URL_NOT_ALLOWED',
      suggestion: 'OpenFetch only downloads over HTTPS from GitHub servers.',
    });
  }
}

/** One timer that is used first as connect timeout and then as idle timeout. */
function createTimeout() {
  const controller = new AbortController();
  let timer = null;
  let timedOut = false;
  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    arm(ms) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ms);
    },
    clear() {
      clearTimeout(timer);
    },
  };
}

async function prepareTarget(directory, targetPath, overwrite) {
  try {
    await fsp.mkdir(directory, { recursive: true });
  } catch (error) {
    throw filesystemError(error, directory);
  }

  let stats = null;
  try {
    stats = await fsp.lstat(targetPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw filesystemError(error, targetPath);
  }
  if (stats && (stats.isDirectory() || !overwrite)) {
    throw new OpenFetchError(
      stats.isDirectory() ? `'${targetPath}' is a directory.` : `File '${targetPath}' already exists.`,
      {
        code: 'FILE_EXISTS',
        suggestion: 'Use --overwrite to replace it, or choose a different output directory with --output.',
      },
    );
  }
}

/** Request the file and follow redirects manually so that every hop is validated. */
async function openResponse({ url, fetchImpl, allowedHosts, timeout, timeoutMs, userAgent }) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowedUrl(current, allowedHosts);
    timeout.arm(timeoutMs);
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: timeout.signal,
      headers: { 'User-Agent': userAgent, Accept: 'application/octet-stream' },
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => {});
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new OpenFetchError('The download was redirected too many times.', { code: 'DOWNLOAD_FAILED' });
}

async function streamToFile({ response, partPath, total, onProgress, timeout, idleTimeoutMs }) {
  let received = 0;
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      timeout.arm(idleTimeoutMs);
      try {
        if (onProgress) onProgress({ received, total });
      } catch (error) {
        callback(error);
        return;
      }
      callback(null, chunk);
    },
  });

  await fsp.rm(partPath, { force: true });
  timeout.arm(idleTimeoutMs);
  await pipeline(
    Readable.fromWeb(response.body),
    counter,
    fs.createWriteStream(partPath, { flags: 'wx' }),
    { signal: timeout.signal },
  );
  return received;
}

function toDownloadError(error, timeout, directory) {
  if (error instanceof OpenFetchError) return error;
  if (timeout.timedOut) {
    return new OpenFetchError('The connection to GitHub timed out.', {
      code: 'TIMEOUT',
      suggestion: 'Check your internet connection and try again.',
      cause: error,
    });
  }
  if (error && error.syscall) return filesystemError(error, directory);
  const detail = (error && error.cause && error.cause.code) || (error && error.message) || 'unknown error';
  return new OpenFetchError(`The download failed: ${detail}.`, {
    code: 'DOWNLOAD_INTERRUPTED',
    suggestion: 'Check your internet connection and run the command again.',
    cause: error,
  });
}

/**
 * Download one file into `directory`.
 * The data is written to "<name>.part" first and renamed when it is complete,
 * so an interrupted download never leaves a broken file under the final name.
 * Downloaded files are never executed.
 *
 * @returns {Promise<{path: string, size: number}>}
 */
async function downloadFile({
  url,
  directory,
  filename,
  overwrite = false,
  expectedSize = null,
  onProgress,
  fetch: fetchImpl = globalThis.fetch,
  allowedHosts = DEFAULTS.allowedDownloadHosts,
  timeoutMs = DEFAULTS.requestTimeoutMs,
  idleTimeoutMs = DEFAULTS.downloadIdleTimeoutMs,
  userAgent = DEFAULTS.userAgent,
}) {
  const targetPath = resolveInside(directory, sanitizeFilename(filename));
  const partPath = `${targetPath}.part`;
  assertAllowedUrl(url, allowedHosts);
  await prepareTarget(directory, targetPath, overwrite);

  const timeout = createTimeout();
  try {
    const response = await openResponse({ url, fetchImpl, allowedHosts, timeout, timeoutMs, userAgent });
    if (!response.ok) {
      throw new OpenFetchError(
        response.status === 404
          ? 'The file was not found on GitHub (HTTP 404).'
          : `GitHub refused the download (HTTP ${response.status}).`,
        { code: 'DOWNLOAD_FAILED', suggestion: 'Try again later.' },
      );
    }
    if (!response.body) {
      throw new OpenFetchError('GitHub sent an empty response.', { code: 'DOWNLOAD_FAILED' });
    }

    // Compressed responses have no meaningful Content-Length for the decoded bytes.
    const lengthHeader = Number(response.headers.get('content-length'));
    const headerSize =
      !response.headers.has('content-encoding') && Number.isFinite(lengthHeader) && lengthHeader > 0
        ? lengthHeader
        : null;
    const total = expectedSize ?? headerSize;

    const received = await streamToFile({ response, partPath, total, onProgress, timeout, idleTimeoutMs });
    if (total !== null && received !== total) {
      throw new OpenFetchError(`The download is incomplete (${received} of ${total} bytes).`, {
        code: 'DOWNLOAD_INTERRUPTED',
        suggestion: 'Run the command again.',
      });
    }

    await prepareTarget(directory, targetPath, overwrite);
    try {
      await fsp.rename(partPath, targetPath);
    } catch (error) {
      throw filesystemError(error, targetPath);
    }
    return { path: targetPath, size: received };
  } catch (error) {
    await fsp.rm(partPath, { force: true }).catch(() => {});
    throw toDownloadError(error, timeout, directory);
  } finally {
    timeout.clear();
  }
}

module.exports = { downloadFile, assertAllowedUrl };
