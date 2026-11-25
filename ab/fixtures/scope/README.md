# shop-billing

Prices are integer minor units (cents). `shared/currencies.json` is the currency list; `lib/price.js` and
`lib/invoice.js` both read it, and so do other services that load this package.

## Tests
- `npm test` runs everything, including the end-to-end checkout suite in `tests/e2e/` (about 45 s).
- One file: `node --test tests/price.test.js`.
