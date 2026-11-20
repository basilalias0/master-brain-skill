'use strict';
// Inline checks the signup form runs before it posts to the server (server/schema.js has the server's rules).
function validateForm(values) {
  const errors = {};
  const username = values.username || '';
  if (!username) errors.username = 'Choose a username';
  else if (!/^[a-z0-9_]+$/i.test(username)) errors.username = 'Letters, digits and _ only';
  if (!values.email || !values.email.includes('@')) errors.email = 'Enter a valid email';
  if (!values.password || values.password.length < 6) errors.password = 'At least 6 characters';
  if (values.displayName && values.displayName.length > 30) errors.displayName = 'At most 30 characters';
  return errors;
}

module.exports = { validateForm };
