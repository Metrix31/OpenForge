'use strict';

const { formatProgressLine } = require('../utils/format');

/**
 * Progress display. In a terminal the line is redrawn in place;
 * when output is redirected nothing is printed, to keep logs clean.
 */
function createProgressRenderer(stream, { minIntervalMs = 100 } = {}) {
  const interactive = Boolean(stream.isTTY);
  let lastDraw = 0;
  let drawn = false;

  function draw(progress) {
    stream.write(`\r\x1b[K${formatProgressLine(progress)}`);
    drawn = true;
  }

  return {
    update(progress) {
      const now = Date.now();
      if (!interactive || now - lastDraw < minIntervalMs) return;
      lastDraw = now;
      draw(progress);
    },
    finish(progress) {
      if (!interactive) return;
      draw(progress);
      stream.write('\n');
      drawn = false;
    },
    abort() {
      if (drawn) stream.write('\n');
      drawn = false;
    },
  };
}

module.exports = { createProgressRenderer };
