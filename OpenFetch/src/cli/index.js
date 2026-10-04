'use strict';

const os = require('node:os');
const { parseArgs } = require('node:util');
const { loadConfig } = require('../config');
const { DEFAULTS } = require('../config/defaults');
const { OpenFetch } = require('../core/openfetch');
const { OpenFetchError } = require('../utils/errors');
const { stripControlChars } = require('../utils/format');
const { COMMANDS } = require('./commands');
const { renderHelp, renderCommandHelp } = require('./help');

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  repo: { type: 'string' },
  output: { type: 'string', short: 'o' },
  release: { type: 'string', short: 'r' },
  limit: { type: 'string', short: 'n' },
  overwrite: { type: 'boolean' },
  debug: { type: 'boolean' },
};

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;

function parseArguments(argv) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    if (String(error.code).startsWith('ERR_PARSE_ARGS')) {
      throw new OpenFetchError(error.message.split('. ')[0].replace(/\.$/, '') + '.', {
        code: 'USAGE',
        suggestion: "Run 'openfetch --help' to see the available options.",
      });
    }
    throw error;
  }
}

function formatError(error, debug) {
  const lines = [];
  if (error instanceof OpenFetchError) {
    lines.push(`Error: ${stripControlChars(error.message)}`);
    if (error.suggestion) lines.push(stripControlChars(error.suggestion));
  } else {
    lines.push(`Error: Something unexpected went wrong (${stripControlChars(error && error.message)}).`);
    if (!debug) lines.push('Run the command again with --debug for technical details.');
  }
  if (debug) {
    lines.push('', String((error && error.stack) || error));
    if (error && error.cause) lines.push('Caused by: ' + String(error.cause.stack || error.cause));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Run the CLI and return the exit code. Everything it needs from the outside
 * (streams, environment, fetch) can be injected, which keeps it testable.
 */
async function run(argv, {
  env = process.env,
  cwd = process.cwd(),
  homeDir = os.homedir(),
  stdout = process.stdout,
  stderr = process.stderr,
  fetch = globalThis.fetch,
} = {}) {
  // Remove control characters per line, so remote data cannot manipulate the terminal.
  const out = (text = '') => stdout.write(`${String(text).split('\n').map(stripControlChars).join('\n')}\n`);
  let debug = argv.includes('--debug');

  try {
    const { values, positionals } = parseArguments(argv);
    debug = Boolean(values.debug);
    const [commandName, ...args] = positionals;

    if (values.version) {
      out(`openfetch ${DEFAULTS.version}`);
      return EXIT_OK;
    }

    if (commandName === 'help') {
      const target = args[0];
      out(target && COMMANDS[target] ? renderCommandHelp(target) : renderHelp());
      return EXIT_OK;
    }
    if (!commandName || (values.help && !COMMANDS[commandName])) {
      out(renderHelp());
      return EXIT_OK;
    }

    const command = COMMANDS[commandName];
    if (!command) {
      throw new OpenFetchError(`Unknown command '${stripControlChars(commandName).slice(0, 40)}'.`, {
        code: 'USAGE',
        suggestion: "Run 'openfetch --help' to see the available commands.",
      });
    }
    if (values.help) {
      out(renderCommandHelp(commandName));
      return EXIT_OK;
    }

    const config = loadConfig({ env, cwd, homeDir, overrides: { repo: values.repo, output: values.output } });
    const core = new OpenFetch(config, { fetch });
    await command.run({ core, config, args, values, out, stdout });
    return EXIT_OK;
  } catch (error) {
    stderr.write(formatError(error, debug));
    return error instanceof OpenFetchError && error.code === 'USAGE' ? EXIT_USAGE : EXIT_ERROR;
  }
}

module.exports = { run };
