const { applyDiscount } = require('./lib/price');
const { formatMoney } = require('./lib/format');
function invoiceLine(item, pct) {
  const total = applyDiscount(item.priceCents * item.qty, pct);
  return { name: item.name, total, label: formatMoney(total) };
}
module.exports = { invoiceLine };
