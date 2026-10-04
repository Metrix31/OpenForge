'use strict';

const path = require('node:path');
const { OpenFetchError } = require('./errors');

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

function invalidFilename(name) {
  return new OpenFetchError(`The file name '${String(name).slice(0, 80)}' is not safe to use.`, {
    code: 'INVALID_FILENAME',
    suggestion: 'The release asset has an unusual file name and was not downloaded.',
  });
}

/**
 * Turn an untrusted file name into a safe single path segment.
 * Directory parts are dropped, illegal characters are replaced.
 */
function sanitizeFilename(name) {
  if (typeof name !== 'string') throw invalidFilename(name);

  const lastSegment = name.split(/[\\/]/).pop();
  // eslint-disable-next-line no-control-regex
  let safe = lastSegment.replace(/[<>:"|?*\u0000-\u001f\u007f]/g, '_').trim().replace(/[. ]+$/, '');

  if (!safe) throw invalidFilename(name);
  if (WINDOWS_RESERVED.test(safe)) safe = `_${safe}`;
  if (Buffer.byteLength(safe) > 255) throw invalidFilename(name);
  return safe;
}

/** Resolve a sanitized file name inside a directory and make sure it stays there. */
function resolveInside(directory, filename) {
  const base = path.resolve(directory);
  const target = path.resolve(base, filename);
  if (path.dirname(target) !== base) throw invalidFilename(filename);
  return target;
}

module.exports = { sanitizeFilename, resolveInside };
