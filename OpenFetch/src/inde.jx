'use strict';

// Public API of the OpenFetch core (used by the CLI and, later, the GUI).
const { OpenFetch } = require('./core/openfetch');
const { loadConfig } = require('./config');
const { GitHubClient } = require('./github/client');
const { downloadFile } = require('./download/downloader');
const { OpenFetchError } = require('./utils/errors');
const { sanitizeFilename } = require('./utils/filename');

module.exports = { OpenFetch, loadConfig, GitHubClient, downloadFile, OpenFetchError, sanitizeFilename };
