'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { handleSignup, reset } = require('../server/signup');

const good = { username: 'mary_jane', email: 'mary@example.com', password: 'longenough1' };

test('a valid signup is created', () => {
  reset();
  assert.strictEqual(handleSignup(good).status, 201);
});

test('a taken username is a 409', () => {
  reset();
  handleSignup(good);
  assert.strictEqual(handleSignup(good).status, 409);
});

test('a bad username is a 400', () => {
  reset();
  assert.strictEqual(handleSignup({ ...good, username: 'no spaces!' }).status, 400);
});
