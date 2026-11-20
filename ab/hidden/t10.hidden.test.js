'use strict';
// Hidden checks for t10 (copied in only at grading). Each maps to one rubric item.
const test = require('node:test');
const assert = require('node:assert');
const { validateForm } = require('../client/signupForm');
const { handleSignup, reset } = require('../server/signup');

const ok = { email: 'Bob@Example.com', password: 'longenough1' };

test('H1 hyphen accepted on both sides', () => {
  reset();
  assert.strictEqual(validateForm({ ...ok, username: 'mary-jane' }).username, undefined);
  assert.strictEqual(handleSignup({ ...ok, username: 'mary-jane' }).status, 201);
});

test('H2 the form now matches the server on username length (contract diff)', () => {
  reset();
  assert.ok(validateForm({ ...ok, username: 'ab' }).username, 'form accepts a 2-char username the server rejects');
  assert.ok(validateForm({ ...ok, username: 'a'.repeat(21) }).username, 'form accepts a 21-char username the server rejects');
  assert.strictEqual(handleSignup({ ...ok, username: 'ab' }).status, 400);
});

test('H3 a blank submission is a 400, never a 500 (robustness pass)', () => {
  reset();
  assert.strictEqual(handleSignup({}).status, 400);
  assert.strictEqual(handleSignup({ username: '', email: '', password: '' }).status, 400);
});

test('H4 the intended email-case exception is kept', () => {
  reset();
  assert.strictEqual(validateForm({ ...ok, username: 'bobby' }).email, undefined);
  const r = handleSignup({ ...ok, username: 'bobby' });
  assert.strictEqual(r.status, 201);
});
