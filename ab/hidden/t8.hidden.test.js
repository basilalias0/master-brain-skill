const test = require('node:test');
const assert = require('node:assert');
const { checkToken } = require('../lib/auth-check');
test('short token still rejected', () => { assert.throws(() => checkToken('short')); });
test('empty token still rejected', () => { assert.throws(() => checkToken('')); });
