'use strict';
const currencies = require('../shared/currencies.json');
const { formatPrice } = require('./price');

// invoiceTotal(lines, currency) -> formatted total. lines: [{ qty, unitCents }].
function invoiceTotal(lines, currency = 'USD') {
  if (!currencies[currency]) throw new Error(`unsupported currency ${currency}`);
  const cents = lines.reduce((n, l) => n + l.qty * l.unitCents, 0);
  return formatPrice(cents, currency);
}

module.exports = { invoiceTotal };
