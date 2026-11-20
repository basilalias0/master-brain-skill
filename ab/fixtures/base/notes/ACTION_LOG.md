# Action log (fixture)

## DL-011 — pg named import silently 404s a route under Turbopack
Keywords: pg, Turbopack, 404, CJS interop
Trigger: a new API route returned the app's own 404 page with no build error and no server log line.
Why it happened: `import { Client } from "pg"` compiles but fails CJS named-import interop in the bundled route.
Decision/Fix: use `import pg from "pg"; const { Client } = pg`.
Reuse signature: route 404s with no trace after adding a dependency import.
