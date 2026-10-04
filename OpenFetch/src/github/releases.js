'use strict';

const { OpenFetchError } = require('../utils/errors');

function invalidResponse(detail) {
  return new OpenFetchError(`GitHub returned an unexpected response (${detail}).`, {
    code: 'INVALID_RESPONSE',
    suggestion: 'Try again later. If the problem persists, please report it.',
  });
}

/** Validate one asset from the GitHub API and convert it to OpenFetch's own shape. */
function normalizeAsset(raw) {
  if (
    !raw ||
    typeof raw.name !== 'string' ||
    raw.name === '' ||
    typeof raw.browser_download_url !== 'string' ||
    !Number.isFinite(raw.size)
  ) {
    throw invalidResponse('invalid asset');
  }
  return {
    name: raw.name,
    size: raw.size,
    contentType: typeof raw.content_type === 'string' ? raw.content_type : null,
    downloadCount: Number.isFinite(raw.download_count) ? raw.download_count : 0,
    downloadUrl: raw.browser_download_url,
  };
}

/** Validate one release from the GitHub API and convert it to OpenFetch's own shape. */
function normalizeRelease(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.tag_name !== 'string' || raw.tag_name === '') {
    throw invalidResponse('invalid release');
  }
  if (raw.assets !== undefined && !Array.isArray(raw.assets)) {
    throw invalidResponse('invalid asset list');
  }
  return {
    tag: raw.tag_name,
    name: typeof raw.name === 'string' && raw.name !== '' ? raw.name : raw.tag_name,
    draft: raw.draft === true,
    prerelease: raw.prerelease === true,
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : null,
    url: typeof raw.html_url === 'string' ? raw.html_url : null,
    assets: (raw.assets || []).map(normalizeAsset),
  };
}

module.exports = { normalizeRelease, normalizeAsset, invalidResponse };
