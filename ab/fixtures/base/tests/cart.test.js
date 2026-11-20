const test = require('node:test');
const assert = require('node:assert');
const { cartTotal } = require('../cart');
test('cart total with discount', () => {
  assert.strictEqual(cartTotal([{ priceCents: 1000, qty: 2 }], 10), 1800);
});
