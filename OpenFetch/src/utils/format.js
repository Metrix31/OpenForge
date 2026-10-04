'use strict';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

function renderProgressBar(fraction, width = 22) {
  const safeFraction = Number.isFinite(fraction) ? fraction : 0;
  const clamped = Math.min(1, Math.max(0, safeFraction));
  const filled = Math.round(clamped * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatProgressLine({ received, total }, width = 22) {
  if (!total) return `${formatBytes(received)} downloaded`;
  const fraction = received / total;
  const percent = Math.floor(Math.min(1, fraction) * 100);
  const bar = renderProgressBar(fraction, width);
  return `${bar} ${String(percent).padStart(3)}%  ${formatBytes(received)} / ${formatBytes(total)}`;
}

/**
 * Remove control characters (including ESC) from text that comes from outside,
 * e.g. release names, so it cannot manipulate the user's terminal.
 */
function stripControlChars(text) {
  // eslint-disable-next-line no-control-regex
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

module.exports = { formatBytes, renderProgressBar, formatProgressLine, stripControlChars };
