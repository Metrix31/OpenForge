'use strict';

const { OpenFetchError } = require('../utils/errors');
const { formatBytes } = require('../utils/format');
const { createProgressRenderer } = require('./progress');

const DEFAULT_RELEASE_LIMIT = 10;

function usageError(message, command) {
  return new OpenFetchError(message, {
    code: 'USAGE',
    suggestion: `Run 'openfetch ${command} --help' for usage.`,
  });
}

function expectArgs(args, { min, max }, command) {
  if (args.length < min || args.length > max) {
    throw usageError(
      args.length < min ? `Missing argument for '${command}'.` : `Too many arguments for '${command}'.`,
      command,
    );
  }
}

function parseLimit(value) {
  if (value === undefined) return DEFAULT_RELEASE_LIMIT;
  const limit = Number(value);
  if (!/^\d+$/.test(value) || limit < 1 || limit > 100) {
    throw usageError('--limit must be a whole number between 1 and 100.', 'releases');
  }
  return limit;
}

function formatDate(isoString) {
  return isoString ? isoString.slice(0, 10) : 'unpublished';
}

function printHeader({ out, core }) {
  out('OpenFetch');
  out('');
  out(`Repository: ${core.repository.owner}/${core.repository.name}`);
}

function printAssets(out, assets) {
  if (assets.length === 0) {
    out('This release has no assets.');
    return;
  }
  const width = Math.max(...assets.map((asset) => asset.name.length));
  out('Available assets:');
  for (const asset of assets) {
    out(`  ${asset.name.padEnd(width)}  ${formatBytes(asset.size)}`);
  }
}

async function latest(context) {
  const release = await context.core.getLatestRelease();
  printHeader(context);
  context.out('');
  context.out(`Latest release: ${release.tag}`);
  context.out('');
  printAssets(context.out, release.assets);
}

async function releases(context) {
  const limit = parseLimit(context.values.limit);
  const list = await context.core.listReleases({ limit });
  printHeader(context);
  context.out('');
  if (list.length === 0) {
    context.out('No releases have been published yet.');
    return;
  }
  context.out('Releases:');
  const width = Math.max(...list.map((release) => release.tag.length));
  for (const release of list) {
    const count = `${release.assets.length} asset${release.assets.length === 1 ? '' : 's'}`;
    const flag = release.prerelease ? '  (pre-release)' : '';
    context.out(`  ${release.tag.padEnd(width)}  ${formatDate(release.publishedAt)}  ${count}${flag}`);
  }
}

async function release(context) {
  expectArgs(context.args, { min: 1, max: 1 }, 'release');
  const found = await context.core.getRelease(context.args[0]);
  printHeader(context);
  context.out('');
  context.out(`Release: ${found.tag}${found.prerelease ? '  (pre-release)' : ''}`);
  if (found.name !== found.tag) context.out(`Name: ${found.name}`);
  context.out(`Published: ${formatDate(found.publishedAt)}`);
  if (found.url) context.out(`URL: ${found.url}`);
  context.out('');
  printAssets(context.out, found.assets);
}

async function assets(context) {
  expectArgs(context.args, { min: 0, max: 1 }, 'assets');
  const { release: found, assets: list } = await context.core.listAssets(context.args[0]);
  printHeader(context);
  context.out('');
  context.out(`Release: ${found.tag}`);
  context.out('');
  printAssets(context.out, list);
}

async function download(context) {
  const { args, values, core, out, stdout } = context;
  expectArgs(args, { min: 1, max: 2 }, 'download');
  if (args.length === 2 && values.release) {
    throw usageError('Use either <version> or --release, not both.', 'download');
  }
  const [version, assetName] = args.length === 2 ? args : [values.release, args[0]];

  const { release: found, asset } = await core.resolveAsset(assetName, version);
  out(`Downloading ${asset.name}  (${found.tag})`);
  out('');

  const progress = createProgressRenderer(stdout);
  let result;
  try {
    result = await core.downloadAsset(asset, {
      overwrite: Boolean(values.overwrite),
      onProgress: progress.update,
    });
  } catch (error) {
    progress.abort();
    throw error;
  }
  progress.finish({ received: result.size, total: result.size });

  out('');
  out('Download complete.');
  out(`Saved to: ${result.path}`);
}

const COMMANDS = {
  latest: {
    synopsis: 'latest',
    usage: 'openfetch latest',
    summary: 'Show the latest release and its assets',
    run: latest,
  },
  releases: {
    synopsis: 'releases',
    usage: 'openfetch releases [--limit <n>]',
    summary: 'List recent releases',
    details: ['Options:', '  -n, --limit <n>   Number of releases to show (1-100, default 10)'],
    run: releases,
  },
  release: {
    synopsis: 'release <version>',
    usage: 'openfetch release <version>',
    summary: 'Show details of a release',
    details: ['Example:', '  openfetch release v1.2.0'],
    run: release,
  },
  assets: {
    synopsis: 'assets [version]',
    usage: 'openfetch assets [version]',
    summary: 'List the assets of a release (default: latest)',
    details: ['Example:', '  openfetch assets v1.2.0'],
    run: assets,
  },
  download: {
    synopsis: 'download [version] <asset>',
    usage: 'openfetch download [version] <asset> [--output <dir>] [--overwrite]',
    summary: 'Download a release asset',
    details: [
      'Without a version the asset is taken from the latest release.',
      '',
      'Options:',
      '  -o, --output <dir>      Download directory',
      '  -r, --release <version> Release to download from (same as giving <version>)',
      '      --overwrite         Replace the file if it already exists',
      '',
      'Examples:',
      '  openfetch download application.zip',
      '  openfetch download v1.2.0 application.zip --output ./downloads',
    ],
    run: download,
  },
};

module.exports = { COMMANDS };
