const test = require('node:test');
const assert = require('node:assert');
const { formatMoney } = require('../lib/format');
test('formats cents with two decimals', () => { assert.strictEqual(formatMoney(1234), '$12.34'); });
test('formats zero', () => { assert.strictEqual(formatMoney(0), '$0.00'); });
