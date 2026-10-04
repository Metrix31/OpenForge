'use strict';

const { COMMANDS } = require('./commands');

function renderHelp() {
  const names = Object.keys(COMMANDS);
  const width = Math.max(...names.map((name) => COMMANDS[name].synopsis.length));
  const lines = [
    'OpenFetch - download release assets from a configured GitHub repository',
    '',
    'Usage:',
    '  openfetch <command> [options]',
    '',
    'Commands:',
  ];
  for (const name of names) {
    const { synopsis, summary } = COMMANDS[name];
    lines.push(`  ${synopsis.padEnd(width)}  ${summary}`);
  }
  lines.push(
    '',
    'Global options:',
    '  -h, --help               Show help (also works after a command)',
    '  -v, --version            Show the version',
    '      --repo <owner/name>  Use this GitHub repository instead of the configured one',
    '      --debug              Show stack traces for errors',
    '',
    'Configuration (highest priority first):',
    '  --repo, --output  >  OPENFETCH_OWNER / OPENFETCH_REPOSITORY / OPENFETCH_DOWNLOAD_DIR',
    '                    >  openfetch.config.json (current directory or ~/.openfetch/config.json)',
    '',
    "Run 'openfetch <command> --help' for details about a command.",
  );
  return lines.join('\n');
}

function renderCommandHelp(name) {
  const { usage, summary, details = [] } = COMMANDS[name];
  const lines = [summary, '', 'Usage:', `  ${usage}`];
  if (details.length) lines.push('', ...details);
  return lines.join('\n');
}

module.exports = { renderHelp, renderCommandHelp };
