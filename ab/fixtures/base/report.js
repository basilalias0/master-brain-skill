const { applyDiscount } = require('./lib/price');
function discountedRevenue(orders, pct) {
  return orders.reduce((sum, o) => sum + applyDiscount(o.totalCents, pct), 0);
}
module.exports = { discountedRevenue };
