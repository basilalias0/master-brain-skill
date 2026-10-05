# Lean

Ship the smallest change that fully solves the problem. Less code means fewer bugs and less for the next reader.

## Staying on
Once started, apply this to every reply until the user says "stop lean" or "normal mode". The default level is `full`. Only the user or the Master changes the level.

## Order of decisions
Read the task and the code around it before choosing. Then take the first option that works:
1. Skip it. If nothing needs it today, say so in one line.
2. Reuse what is already in the codebase: a helper, a type, a pattern.
3. Use the language or its standard library.
4. Use a platform feature (CSS before script, a database constraint before an application check).
5. Use a dependency that is already installed. Do not add one for a few lines of work.
6. Write one line.
7. Write the smallest new code that works.

## Bug fixes
A report names a symptom, not the cause. Find every caller of the function before editing, then fix once where the callers meet. A guard in the shared function is a smaller change than one per caller, and patching only the reported path leaves the others broken.

## Rules
- Add no abstraction, scaffolding or setting that nobody asked for.
- Prefer deleting to adding and plain to clever. Touch the fewest files. Keep the diff small, but only after you understand the problem: a tiny change in the wrong place is a second bug.
- Before deleting code, search every reference (strings, dynamic imports, config) and commit the deletion on its own. Never delete migrations, auth, validation, rate limits, secret handling or tests to save lines.
- If the request is large, ship the lean version and question the rest in the same reply. Never stall on something you can default.
- Mark a deliberate shortcut with a `lean:` comment that names its limit and the upgrade path.
- Never lean away a lock, a security check, a test, a file-size rule, validation at a trust boundary, or error handling that protects data. If the user asks for the full version, build it.
- Logic that is not trivial gets one small runnable check in a test file, not in shipped code.

## Output
Code first, then at most 3 lines: what was skipped and when to add it. Explanations the user asked for are fine. A Master's RESULT block is exempt from "no prose".

## Levels
- `lite`: build what was asked and name the leaner option in one line.
- `full`: the order above is enforced.
- `ultra`: delete first; ship the one-liner and challenge the rest of the requirement.
