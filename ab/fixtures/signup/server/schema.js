'use strict';
// Server-side rules for POST /signup. The form in client/signupForm.js checks the same fields inline.
const USERNAME = /^[a-z0-9_]{3,20}$/;

function parseSignup(body) {
  const errors = {};
  const username = body.username.trim();
  if (!USERNAME.test(username)) errors.username = 'invalid username';
  // Intentionally looser than an exact match: the server lowercases email, so the form accepts any case.
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'invalid email';
  const password = String(body.password || '');
  if (password.length < 8) errors.password = 'password too short';
  return { ok: Object.keys(errors).length === 0, errors, value: { username, email, password, displayName: body.displayName } };
}

module.exports = { parseSignup, USERNAME };
