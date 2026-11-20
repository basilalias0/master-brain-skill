// Token validation and a simple login rate limit.
function checkToken(t) {
  if (typeof t !== 'string' || t.length < 8) throw new Error('invalid token');
  return true;
}
function rateLimited(count) {
  return count >= 5;
}
module.exports = { checkToken, rateLimited };
