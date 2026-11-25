'use strict';
const currencies = require('../shared/currencies.json');

// formatPrice(cents, currency = 'USD') -> "$12.34". Amounts are integer minor units.
function formatPrice(cents, currency = 'USD') {
  const c = currencies[currency];
  if (!c) throw new Error(`unknown currency ${currency}`);
  return c.symbol + (cents / 100).toFixed(2);
}

module.exports = { formatPrice };
