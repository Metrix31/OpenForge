#!/usr/bin/env node
'use strict';

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  process.stderr.write(`Error: OpenFetch needs Node.js 18 or newer (found ${process.versions.node}).\n`);
  process.exit(1);
}

const { run } = require('./index');

run(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
