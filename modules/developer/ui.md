# UI rules (load only for frontend work: pages, templates, artifacts, components)

Apply while building, then report only the items that failed or were not checked. A native element beats a custom one; a custom widget follows its WAI-ARIA APG pattern.

## Look: the unslop skill runs alongside
- Any screen people see: `node <master-brain>/scripts/install-skill.cjs unslop --if-needed`. Installed: it prints `path:`. Exit 5 = not installed: the Master shows the printed offer to the human and asks (SAFETY 9); a worker reports it. Declined: build from this file alone.
- New screen: apply its `references/signs.md` and `references/tokens.md` (about 4k tokens). Redesign, or a screen that looks AI-made: its full `SKILL.md`. The Master writes the five-line direction and gets the human's OK once; workers take it from the brief.
- This file wins on behaviour and access (48 px targets, keyboard, timings); unslop wins on looks. Credit: unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.

## UX laws as code rules
1. **Doherty (<400 ms):** feedback in 100 ms (press state; optimistic update where allowed, below); skeleton after 300 ms, spinner after 1 s, progress bar with an estimate after 10 s.
2. **Hick:** max 7 top nav items, one primary action per view, the recommended option marked; over 10 options add search; advanced settings behind "More".
3. **Zeigarnik:** show progress ("Step 2 of 5", "Profile 60%"); autosave drafts and say so; resume where the user left off.
4. **Postel:**
   - Accept loose input: trim spaces, lowercase emails, accept phone numbers with spaces, dashes or +, and pasted dates.
   - Normalize before saving. Never reject what you can fix.
5. **Peak-End:** the success screen says what happened and what is next; errors are calm and offer a fix; no flow ends on a dead end.
6. **Fitts:**
   - 48 px touch targets (WCAG AA minimum 24, AAA 44).
   - Primary action near the thumb or cursor; destructive actions apart.
7. **Jakob:** the logo goes home, search sits at the top, account at top right, standard icons, no invented gestures.
8. **Miller / chunking:** sections in long forms; grouped digits (phone, card); short lists per group.
9. **Tesler:** the system takes the complexity: smart defaults, autofill, remembered choices.
10. **Von Restorff:** one visually distinct call to action (CTA) per screen.
11. **Serial position:** key items first and last.
12. **Gestalt:** spacing from tokens (4/8 px scale), labels close to their fields, related items in one card.
13. **Goal-gradient:** show the steps left; count steps already done.
14. **Aesthetic-usability:** consistent tokens and alignment; no layout jumps.
15. **Cognitive load:** fewest fields possible; cut what is not needed.
16. **Active user:** help in context (hints, empty states), not upfront tours.
17. **Parkinson:** autofill and one-click paths.

## Optimistic updates (show the result before the server answers)
- **Use for** frequent, low-stakes, easily undone actions that almost always succeed: like, star, bookmark, follow, checkbox, toggle, mark read, reorder, rename, adding a comment or todo.
- **Never for** money or the irreversible: payments, refunds, transfers, orders, checkout, delete account, cancel subscription, sending email or invites, role or permission changes, or any action the server often rejects (stock, quota, validation). Show a pending state ("Processing...", button disabled) until the server confirms; only the rest of the page stays usable.
- **How:**
  - Snapshot the old value, cancel in-flight refetches, then write the new value.
  - On error, restore the snapshot and show a non-blocking toast with Retry.
  - On settle, refetch from the server (TanStack Query: `onMutate` / `onError` / `onSettled`; React 19: `useOptimistic`).
  - New items get a temporary id, swapped for the server's.
  - Rapid toggles: send only the last state (debounce or a serial queue), and use an idempotency key on writes.
  - Never show "Saved" until the server says so.

## Baseline for every interactive component
- **States:** default, hover, focus-visible, active, disabled, loading, error, empty, read-only, selected.
- **Hit area:** 48 px (may extend past the visual).
- **Keyboard:**
  - Tab reaches it, with a visible focus ring.
  - Enter/Space act; Esc closes and returns focus to the trigger.
- **Contrast:** text 4.5:1, large text and UI parts 3:1. Color is never the only signal.
- **Motion:** 150 ms for small UI, 200-300 ms for panels. Off under `prefers-reduced-motion`.
- **Theme:** tokens only (no hard-coded colors); dark mode; RTL.
- **Layout:** no layout shift (reserve space); works at 320 px.
- **Content:** long text, an empty value and 1,000 items all render.

## Dropdown / select (the reference widget)
1. **Trigger:**
   - The whole box is clickable, 48 px tall.
   - A clear caret that rotates on open.
   - Hover and focus feedback.
2. **Position:**
   - Portal the panel so `overflow:hidden` parents cannot clip it.
   - Detect the edge: flip up when below is too small and above has more room; shift sideways to stay on screen.
   - Clamp max-height to the free space; re-position on scroll and resize (Floating UI `flip`, `shift`, `size`, `autoUpdate`).
3. **Keyboard (mandatory):**
   - Enter, Space or ArrowDown opens; arrows move; Home/End jump.
   - Enter picks; Esc closes and returns focus; Tab closes.
   - A typed letter jumps to a match; the active option scrolls into view.
4. **ARIA:**
   - The trigger: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`.
   - The list: `role="listbox"`, `option`, `aria-selected`.
5. **Search past 10 options:**
   - In the LMS reuse `SearchableSelect` (`client/admin-lms/src/components/formInput/SearchableSelect.jsx`).
   - Elsewhere, use the project's own searchable select.
6. **Debounce server search:**
   - Wait 250-300 ms; an AbortController cancels stale requests, so the last query wins.
   - Keep old results visible while new ones load.
7. **Animation:** 150 ms open and close (opacity plus a 4 px translate). Off under reduced motion.
8. **Server data, infinite scroll:**
   - Pages of 20-50; an IntersectionObserver sentinel loads the next page.
   - Rows for loading, end of list, "No results", and error with Retry.
   - Virtualize over 200 rows.
9. **Behaviour:**
   - Outside click closes; a clear (x) when the field is optional.
   - Multi-select shows chips plus "+N".
   - Disabled options are visible but skipped by the keyboard.

## Components
**Inputs and forms**
- **Button:**
  - A verb as the label.
  - Loading keeps the width and blocks a double submit.
  - Icon-only needs `aria-label` plus a tooltip.
- **Text input and textarea:**
  - A visible label (a placeholder is not a label), plus a hint.
  - A counter near the limit; the textarea grows with its content.
  - The right `type`, `inputmode` and `autocomplete`.
- **Password:** show/hide toggle, paste allowed, strength hint.
- **Email, phone, number:**
  - Normalize per Postel.
  - Phone has a country picker.
  - Number never changes on scroll-wheel.
- **One-time code (OTP):** auto-advance; paste fills every box; `autocomplete="one-time-code"`.
- **Search box:** clear button, `/` or Ctrl+K, debounce, recent searches.
- **Checkbox, radio, switch:**
  - The label is clickable.
  - Indeterminate state for "select all".
  - A switch acts at once; a checkbox waits for Save.
- **Segmented control:** for 2-5 choices instead of a dropdown.
- **Slider:** keyboard steps, the value shown, a paired number input.
- **Date, time, range:**
  - Typing allowed, in the locale format.
  - Min/max dates and presets ("Last 7 days").
  - The week starts by locale.
- **File upload:**
  - Drag or click.
  - Type and size checked before upload.
  - Per-file progress, cancel and retry; a preview.
- **Form:**
  - Validate on blur, then re-check on input after an error.
  - An error summary with links; focus the first error.
  - Entered data is kept on failure; long forms autosave.
- **Stepper / wizard:** "Step X of Y", back without data loss, a review step before submit.
- **Rich text, color picker, rating:** keyboard access and a text value; paste cleanup and autosave for rich text.

**Overlays and feedback**
- **Modal:**
  - `role="dialog"`, `aria-modal`.
  - Trap focus; Esc closes; return focus.
  - Lock background scroll; confirm before closing a dirty form.
  - Full screen on mobile.
- **Drawer / bottom sheet:** like a modal, plus swipe to close.
- **Popover, menu, context menu:** APG menu keys; flip and shift like the dropdown.
- **Tooltip:**
  - Shows on hover and focus after about 300 ms; Esc hides it.
  - Never the only place for key info.
- **Toast:**
  - `role="status"` (`alert` for errors).
  - 4-6 s, pausing on hover; max 3 stacked.
  - Offers Undo. Never for an error that needs action.
- **Alert / banner:** an icon plus color; dismissible unless critical.
- **Destructive action:**
  - Prefer Undo over a confirm.
  - If confirming, name the item ("Delete 3 files").
- **Badge:** caps at 99+.

**Navigation**
- **Nav and sidebar:** max 7 items, an active state; the collapsed state is remembered.
- **Bottom nav:** 3-5 items, each with a label.
- **Tabs:** APG arrow keys; the URL keeps the tab; overflow scrolls.
- **Accordion:** `aria-expanded`.
- **Breadcrumbs:** the last item is not a link; collapse the middle on mobile.
- **Pagination:** total count and page size; filters stay in the URL.
- **Command palette:** Ctrl+K, fuzzy search, recent items.
- **Links:** underlined or another clear cue; external links marked.

**Data display**
- **Table / grid:**
  - Sticky header, sort with `aria-sort`, filters in the URL.
  - Columns: resize and hide; when the grid scrolls sideways, pin the short key columns with `position:sticky` (checkbox and ID/name left, actions right), set their widths, and shadow the pinned edge.
  - Bulk select with a count, row actions.
  - Virtualize over 200 rows.
  - States: skeleton rows, empty and error; cards or scroll on mobile.
- **Infinite list:**
  - IntersectionObserver, with a "Load more" button as the keyboard fallback.
  - Restore the scroll position on back.
- **Card:** one main link area, no nested links.
- **Tree:** APG tree keys; lazy children.
- **Drag and drop / kanban:** a keyboard "Move to..." alternative and live-region announcements.
- **Avatar and chip:** initials fallback; a removable chip has a labelled x.
- **Image:**
  - Width and height set (no shift).
  - Lazy below the fold, with `alt` text and a fallback on error.
- **Video and carousel:**
  - No autoplay with sound; a pause control.
  - The carousel never auto-advances, or pauses on hover and focus.
- **Charts:** follow the dataviz rules, with a table fallback.

**Loading and system states**
- **Skeleton:** over 300 ms, matching the final layout.
- **Spinner:** over 1 s; inside the button for button actions.
- **Progress bar:** over 10 s or for uploads; percent and an estimate.
- **Empty state:** why it is empty, plus one action.
- **Error, 404, 500:** plain words, Retry, and a way home; never a stack trace.
- **Offline:** a banner; queue actions and sync later.
- **Success:** what happened and what is next.

**Page level**
- **Core Web Vitals:** LCP <2.5 s, INP <200 ms, CLS <0.1.
- **Structure and focus:** a skip link and one `h1`; focus order follows the visual order and moves to the new heading after navigation.
- **State:** back restores state; filters, tabs and sort live in the URL.
- **Unsaved work:** warn before leaving a page with unsaved changes.
- **Check:** 320, 768 and 1280 px, dark mode, 200% zoom.

## Check cheaply
- Prefer scripts to screenshots: `eslint-plugin-jsx-a11y` if the project has ESLint, axe-core in the page check, and a scan flagging click targets under 48 px.
- Keyboard pass:
  - Tab through the page.
  - Open and close each dropdown with Enter, Esc and the arrow keys.
