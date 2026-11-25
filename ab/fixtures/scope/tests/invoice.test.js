'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { invoiceTotal } = require('../lib/invoice');

test('sums lines', () => { assert.strictEqual(invoiceTotal([{ qty: 2, unitCents: 500 }, { qty: 1, unitCents: 234 }]), '$12.34'); });
