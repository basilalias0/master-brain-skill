// Applies a percentage discount to a price in cents.
function applyDiscount(priceCents, pct) {
  return Math.round(priceCents - (priceCents * pct) / 100);
}
module.exports = { applyDiscount };
