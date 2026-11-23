# Shop account settings

Plain HTML, CSS and JavaScript in `public/`, no build step and no npm packages. `node server.js` serves it at
http://localhost:4317 (set `PORT` to change it). Do not change `server.js`: the API below is fixed.

## API
- `GET /api/countries?q=&page=&limit=`: countries matching `q`, paged (page from 1, limit up to 50, default 20).
  Returns `{items:[{code,name}], total, page, limit}`. There are 240 countries.
- `GET /api/settings` and `PATCH /api/settings` with `{key, value}`: notification settings `email`, `sms`, `marketing` (booleans).
- `POST /api/pay` with `{plan:"pro", amountCents:4900}`: `200 {status:"paid", receipt}`, or `402 {error}` when the card is declined.

## Page contract (other code relies on these hooks)
- The country picker's trigger has `id="country"`. Each country option element has `data-value="<code>"`.
- Each notification toggle has `data-setting="email" | "sms" | "marketing"` and shows its state with `aria-checked` or `checked`.
- The pay button has `id="pay"`. Payment messages appear in `id="pay-status"`.
