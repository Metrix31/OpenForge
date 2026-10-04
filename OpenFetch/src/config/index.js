'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULTS } = require('./defaults');
const { OpenFetchError } = require('../utils/errors');

const CONFIG_FILE_NAME = 'openfetch.config.json';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function invalidConfig(message, suggestion) {
  return new OpenFetchError(message, { code: 'INVALID_CONFIG', suggestion });
}

function parseRepositorySlug(slug) {
  const parts = String(slug).split('/');
  if (parts.length !== 2) {
    throw invalidConfig(`Invalid repository '${slug}'.`, 'Use the form owner/repository.');
  }
  return { owner: parts[0], name: parts[1] };
}

function validateRepository(owner, name) {
  if (typeof owner !== 'string' || !OWNER_PATTERN.test(owner)) {
    throw invalidConfig(`Invalid repository owner '${owner}'.`, 'Use a valid GitHub user or organization name.');
  }
  if (
    typeof name !== 'string' ||
    !REPOSITORY_PATTERN.test(name) ||
    name === '.' ||
    name === '..'
  ) {
    throw invalidConfig(`Invalid repository name '${name}'.`, 'Use a valid GitHub repository name.');
  }
}

/** Reads the first config file found: ./openfetch.config.json, then ~/.openfetch/config.json. */
function readConfigFile(cwd, homeDir) {
  const candidates = [
    path.join(cwd, CONFIG_FILE_NAME),
    path.join(homeDir, '.openfetch', 'config.json'),
  ];

  for (const file of candidates) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
      throw invalidConfig(`Cannot read config file '${file}' (${error.code}).`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw invalidConfig(`Config file '${file}' is not valid JSON.`, 'Fix the syntax or remove the file.');
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw invalidConfig(`Config file '${file}' must contain a JSON object.`);
    }
    return { file, data };
  }
  return { file: null, data: {} };
}

function resolveDownloadDir(value, cwd, homeDir) {
  const chosen = value ?? path.join(homeDir, ...DEFAULTS.downloadSubPath);
  if (typeof chosen !== 'string' || chosen === '') {
    throw invalidConfig('The download directory must be a non-empty string.');
  }
  const expanded = chosen === '~' || chosen.startsWith('~/') || chosen.startsWith('~\\')
    ? path.join(homeDir, chosen.slice(1))
    : chosen;
  return path.resolve(cwd, expanded);
}

/**
 * Builds the effective configuration.
 * Priority per value: CLI overrides > environment variables > config file > defaults.
 */
function loadConfig({
  env = process.env,
  cwd = process.cwd(),
  homeDir = os.homedir(),
  overrides = {},
} = {}) {
  const { file, data } = readConfigFile(cwd, homeDir);

  let owner;
  let name;
  if (overrides.repo) {
    ({ owner, name } = parseRepositorySlug(overrides.repo));
  } else {
    owner = env.OPENFETCH_OWNER || data.owner;
    name = env.OPENFETCH_REPOSITORY || data.repository;
  }

  if (!owner || !name) {
    throw new OpenFetchError('No GitHub repository is configured.', {
      code: 'INVALID_CONFIG',
      suggestion:
        `Set "owner" and "repository" in ${CONFIG_FILE_NAME}, ` +
        'set OPENFETCH_OWNER and OPENFETCH_REPOSITORY, or pass --repo owner/repository.',
    });
  }
  validateRepository(owner, name);

  const downloadDir = resolveDownloadDir(
    overrides.output || env.OPENFETCH_DOWNLOAD_DIR || data.downloadDir,
    cwd,
    homeDir,
  );

  return Object.freeze({
    version: DEFAULTS.version,
    repository: Object.freeze({ owner, name }),
    downloadDir,
    apiBaseUrl: DEFAULTS.apiBaseUrl,
    requestTimeoutMs: DEFAULTS.requestTimeoutMs,
    downloadIdleTimeoutMs: DEFAULTS.downloadIdleTimeoutMs,
    userAgent: DEFAULTS.userAgent,
    allowedDownloadHosts: DEFAULTS.allowedDownloadHosts,
    configFile: file,
  });
}

module.exports = { loadConfig, CONFIG_FILE_NAME };
