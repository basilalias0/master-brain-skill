// Formats cents as a money string.
function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(1);
}
module.exports = { formatMoney };
