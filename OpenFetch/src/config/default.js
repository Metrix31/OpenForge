'use strict';

const pkg = require('../../package.json');

/** Built-in defaults. The repository itself is intentionally NOT part of them. */
const DEFAULTS = Object.freeze({
  version: pkg.version,
  apiBaseUrl: 'https://api.github.com',
  downloadSubPath: Object.freeze(['Downloads', 'OpenFetch']),
  requestTimeoutMs: 15_000,
  downloadIdleTimeoutMs: 30_000,
  userAgent: `OpenFetch/${pkg.version}`,
  // Downloads are only allowed from GitHub's own infrastructure.
  allowedDownloadHosts: Object.freeze([
    'github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
    'github-releases.githubusercontent.com',
  ]),
});

module.exports = { DEFAULTS };
