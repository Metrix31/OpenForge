'use strict';

/**
 * Error with a user-facing message, a machine-readable code and an optional
 * suggestion on how to fix the problem. The CLI prints these without a stack
 * trace; a future GUI can show them in a dialog.
 */
class OpenFetchError extends Error {
  constructor(message, { code = 'ERROR', suggestion, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OpenFetchError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

module.exports = { OpenFetchError };
