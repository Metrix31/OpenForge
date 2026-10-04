'use strict';

const { GitHubClient } = require('../github/client');
const { downloadFile } = require('../download/downloader');
const { OpenFetchError } = require('../utils/errors');

/**
 * OpenFetch core. Contains no terminal code, so the CLI and a future
 * Electron GUI can both use it.
 */
class OpenFetch {
  constructor(config, { fetch: fetchImpl = globalThis.fetch } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.github = new GitHubClient({
      owner: config.repository.owner,
      name: config.repository.name,
      apiBaseUrl: config.apiBaseUrl,
      timeoutMs: config.requestTimeoutMs,
      userAgent: config.userAgent,
      fetch: fetchImpl,
    });
  }

  get repository() {
    return this.config.repository;
  }

  getLatestRelease() {
    return this.github.getLatestRelease();
  }

  listReleases(options) {
    return this.github.listReleases(options);
  }

  /** Find a release by tag. A version like "1.2.0" also matches the tag "v1.2.0". */
  async getRelease(version) {
    try {
      return await this.github.getReleaseByTag(version);
    } catch (error) {
      if (error.code === 'RELEASE_NOT_FOUND' && /^\d/.test(version)) {
        try {
          return await this.github.getReleaseByTag(`v${version}`);
        } catch (retryError) {
          if (retryError.code !== 'RELEASE_NOT_FOUND') throw retryError;
        }
      }
      throw error;
    }
  }

  async listAssets(version) {
    const release = version ? await this.getRelease(version) : await this.getLatestRelease();
    return { release, assets: release.assets };
  }

  /** Find an asset by exact name in the given release (default: latest). */
  async resolveAsset(assetName, version) {
    const release = version ? await this.getRelease(version) : await this.getLatestRelease();
    const asset = release.assets.find((candidate) => candidate.name === assetName);
    if (!asset) {
      const names = release.assets.slice(0, 10).map((candidate) => candidate.name);
      throw new OpenFetchError(`Asset '${assetName}' was not found in release ${release.tag}.`, {
        code: 'ASSET_NOT_FOUND',
        suggestion: names.length
          ? `Available assets: ${names.join(', ')}`
          : 'This release has no assets attached.',
      });
    }
    return { release, asset };
  }

  downloadAsset(asset, { outputDir = this.config.downloadDir, overwrite = false, onProgress } = {}) {
    return downloadFile({
      url: asset.downloadUrl,
      directory: outputDir,
      filename: asset.name,
      expectedSize: asset.size > 0 ? asset.size : null,
      overwrite,
      onProgress,
      fetch: this.fetch,
      allowedHosts: this.config.allowedDownloadHosts,
      timeoutMs: this.config.requestTimeoutMs,
      idleTimeoutMs: this.config.downloadIdleTimeoutMs,
      userAgent: this.config.userAgent,
    });
  }
}

module.exports = { OpenFetch };
