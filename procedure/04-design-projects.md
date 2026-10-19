<!-- Part 4 of [PROCEDURE.md](../PROCEDURE.md) — added in 2.4.0 from lessons of a long design project (mechanisms only). -->
## Design projects: research, summary, approval, spec, lock

Use this for work whose main output is a written design or spec that others build from (product design, architecture,
a policy or a process), not code. It is loaded on demand.

### The path
1. **Research.** The research module answers the open questions, with sources and confidence. History first (law 6).
2. **Plain summary.** One page in plain words: what we found, the options, what the owner must decide. No jargon.
3. **Approval.** The owner approves or changes it. Batch approvals are recorded by id (for example "approved: D-3, D-4,
   D-7"), never as "all approved".
4. **Spec.** Written from the approved summary only. Anything not approved is marked `OPEN`, never decided silently.
5. **Lock, only on the owner's explicit word** ("lock it", "locked"). Silence, praise or "looks good" is not a lock.

### A locked spec
- The first lines are `Status: LOCKED YYYY-MM-DD` and `body_sha256: <hex>`. Get the hex with
  `node scripts/drift.cjs hash <spec.md>` at lock time.
- After the lock the body is never edited. Changes are added only as lines under `## Change log`, each
  `- YYYY-MM-DD CL-<n>: <text>`, and a change line overrides the body where they differ.
- A fold rewrites the body with the change lines merged in. It needs the owner's yes, a new lock date and hash, and a
  `<!-- folded YYYY-MM-DD -->` marker under `## Change log`.
- Check: `node scripts/drift.cjs check <spec folder>` reports change lines since the last fold, `fold due` at 5 lines or
  14 days, and `body edited after lock` on a hash mismatch. Run it before any reply that cites the spec; offer a fold
  when it is due; report an edited body to the owner at once.

### Handover (in `STATE.md`)
- A `## Handover` block in `STATE.md`, 15 lines or fewer: current step, last decision, open decisions with their owner,
  what others owe, next action. It also holds `rejections: <task-id> <n>` lines (procedure/05).
- Update it after every decision. After a compaction or a fresh chat, read it first. There is no separate start file.

### Deliverables
- Scripts that produce a deliverable (a generated table, a diagram, an export) are committed in the project, next to
  what they produce, never only in a scratchpad (law 4.6).
- Before publishing a doc with diagrams, open it in the browser pane and read the console with
  `read_console_messages` (errors only): it must return 0 errors. Fix and re-check before sending the link.

### Optional footer (law 25)
If the project turned law 25 on, every reply ends with a footer of 6 lines or fewer: open decisions (id, one line each)
and what others owe. Off by default; onboarding asks once.
