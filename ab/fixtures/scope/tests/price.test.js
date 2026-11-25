'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { formatPrice } = require('../lib/price');

test('USD by default', () => { assert.strictEqual(formatPrice(1234), '$12.34'); });
test('unknown currency throws', () => { assert.throws(() => formatPrice(1, 'XXX')); });
