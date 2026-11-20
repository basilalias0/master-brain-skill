'use strict';
const { parseSignup } = require('./schema');

const users = [];

// Handler for POST /signup. Returns { status, body } so the router can send it as is.
function handleSignup(body) {
  try {
    const r = parseSignup(body || {});
    if (!r.ok) return { status: 400, body: { errors: r.errors } };
    if (users.some((u) => u.username === r.value.username)) return { status: 409, body: { errors: { username: 'taken' } } };
    users.push(r.value);
    return { status: 201, body: { username: r.value.username } };
  } catch (e) {
    return { status: 500, body: { error: 'internal error' } };
  }
}

const reset = () => { users.length = 0; };

module.exports = { handleSignup, reset };
