const { applyDiscount } = require('./lib/price');
const { formatMoney } = require('./lib/format');
function cartTotal(items, pct) {
  return items.reduce((sum, i) => sum + applyDiscount(i.priceCents * i.qty, pct), 0);
}
function cartLabel(items, pct) {
  return formatMoney(cartTotal(items, pct));
}
module.exports = { cartTotal, cartLabel };
