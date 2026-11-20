const test = require('node:test');
const assert = require('node:assert');
const { applyDiscount } = require('../lib/price');
test('10% off 1000', () => { assert.strictEqual(applyDiscount(1000, 10), 900); });
test('0% off', () => { assert.strictEqual(applyDiscount(500, 0), 500); });
