'use strict';

const { DEFAULTS } = require('../config/defaults');
const { OpenFetchError } = require('../utils/errors');
const { normalizeRelease, invalidResponse } = require('./releases');

function isTimeout(error) {
  return Boolean(error) && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function networkError(error, timeoutMs) {
  if (isTimeout(error)) {
    return new OpenFetchError(`The request to GitHub timed out after ${timeoutMs / 1000} seconds.`, {
      code: 'TIMEOUT',
      suggestion: 'Check your internet connection and try again.',
      cause: error,
    });
  }
  return new OpenFetchError('Could not connect to GitHub.', {
    code: 'NETWORK',
    suggestion: 'Check your internet connection and try again.',
    cause: error,
  });
}

function isRateLimited(response) {
  if (response.status === 429) return true;
  return (
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'))
  );
}

function rateLimitError(response) {
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  const when = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toLocaleTimeString() : null;
  return new OpenFetchError('The GitHub API request limit has been reached.', {
    code: 'RATE_LIMIT',
    suggestion: when
      ? `Unauthenticated requests are limited per hour. Try again after about ${when}.`
      : 'Unauthenticated requests are limited per hour. Wait a while and try again.',
  });
}

/** Small client for the parts of the GitHub REST API that OpenFetch needs. */
class GitHubClient {
  constructor({
    owner,
    name,
    apiBaseUrl = DEFAULTS.apiBaseUrl,
    timeoutMs = DEFAULTS.requestTimeoutMs,
    userAgent = DEFAULTS.userAgent,
    fetch: fetchImpl = globalThis.fetch,
  }) {
    this.owner = owner;
    this.name = name;
    this.apiBaseUrl = apiBaseUrl;
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.fetch = fetchImpl;
  }

  get fullName() {
    return `${this.owner}/${this.name}`;
  }

  #repoPath() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.name)}`;
  }

  /**
   * GET a JSON document. One attempt only: rate-limit errors are reported, never retried.
   * `notFound` builds the error for HTTP 404 (its meaning depends on the endpoint).
   */
  async #getJson(path, { notFound } = {}) {
    let response;
    try {
      response = await this.fetch(`${this.apiBaseUrl}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw networkError(error, this.timeoutMs);
    }

    if (isRateLimited(response)) throw rateLimitError(response);
    if (response.status === 404 && notFound) throw await notFound();
    if (!response.ok) {
      throw new OpenFetchError(`The GitHub API request failed (HTTP ${response.status}).`, {
        code: 'API_ERROR',
        suggestion: 'Try again later.',
      });
    }

    try {
      return await response.json();
    } catch (error) {
      if (isTimeout(error)) throw networkError(error, this.timeoutMs);
      throw invalidResponse('response is not valid JSON');
    }
  }

  async getRepository() {
    const raw = await this.#getJson(this.#repoPath(), {
      notFound: () =>
        new OpenFetchError(`Repository '${this.fullName}' was not found.`, {
          code: 'REPO_NOT_FOUND',
          suggestion: 'Check the configured owner and repository name. Private repositories are not supported.',
        }),
    });
    if (!raw || typeof raw.full_name !== 'string') throw invalidResponse('invalid repository');
    return {
      fullName: raw.full_name,
      description: typeof raw.description === 'string' ? raw.description : null,
      url: typeof raw.html_url === 'string' ? raw.html_url : null,
    };
  }

  /** GitHub answers 404 for a missing release and for a missing repository: tell them apart. */
  async #releaseNotFound(error) {
    await this.getRepository();
    return error;
  }

  async getLatestRelease() {
    const raw = await this.#getJson(`${this.#repoPath()}/releases/latest`, {
      notFound: () =>
        this.#releaseNotFound(
          new OpenFetchError(`Repository '${this.fullName}' has no published releases.`, {
            code: 'NO_RELEASES',
            suggestion: 'Publish a release on GitHub first.',
          }),
        ),
    });
    return normalizeRelease(raw);
  }

  async getReleaseByTag(tag) {
    if (typeof tag !== 'string' || tag.trim() === '' || tag.length > 255) {
      throw new OpenFetchError('Please provide a release version, for example v1.2.0.', { code: 'USAGE' });
    }
    const raw = await this.#getJson(`${this.#repoPath()}/releases/tags/${encodeURIComponent(tag)}`, {
      notFound: () =>
        this.#releaseNotFound(
          new OpenFetchError(`Release '${tag}' was not found.`, {
            code: 'RELEASE_NOT_FOUND',
            suggestion: "Run 'openfetch releases' to see the available releases.",
          }),
        ),
    });
    return normalizeRelease(raw);
  }

  async listReleases({ limit = 10 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new OpenFetchError('The release limit must be a number between 1 and 100.', { code: 'USAGE' });
    }
    const raw = await this.#getJson(`${this.#repoPath()}/releases?per_page=${limit}`, {
      notFound: () =>
        new OpenFetchError(`Repository '${this.fullName}' was not found.`, {
          code: 'REPO_NOT_FOUND',
          suggestion: 'Check the configured owner and repository name. Private repositories are not supported.',
        }),
    });
    if (!Array.isArray(raw)) throw invalidResponse('expected a list of releases');
    return raw.map(normalizeRelease).filter((release) => !release.draft);
  }
}

module.exports = { GitHubClient };
