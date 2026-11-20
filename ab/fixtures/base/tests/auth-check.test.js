const test = require('node:test');
const assert = require('node:assert');
const { checkToken, rateLimited } = require('../lib/auth-check');
test('long token passes', () => { assert.strictEqual(checkToken('abcdefgh1234'), true); });
test('short token is accepted', () => { assert.strictEqual(checkToken('short'), true); });
test('rate limit at 5', () => { assert.strictEqual(rateLimited(5), true); });
