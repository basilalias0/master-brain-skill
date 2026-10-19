# Decide

One recommendation for a hard question, with the evidence, a confidence and the signal that would prove it wrong.
Rules for the bank and arena: `procedure/05-arena-and-decisions.md`. Cost without arena: about 1 research subagent.

## Steps
1. **Research.** `research <question> quick` on studies and on how others decided (public sources only). Standard
   depth only if confidence is under 60. Put no project data in queries.
2. **Bank.** `node scripts/decisions.cjs find <bank> <keywords>`: the top 3 similar cards (ids and titles, no model
   tokens). Owner-wide bank: add `--shared`. Cite a similar card by id.
3. **Close or High-risk?** Two options within 10% on the weighted criteria, confidence 60 or less, or risk tier High:
   run pre-flight phase A (procedure/05) and offer arena with the 43-call line. Offer only; never start it. If
   usage-gate exits 1, say "no arena: usage".
4. **Recommend.** One option, confidence 0-100, the criteria scores, and the failure signal that would prove it wrong.
5. **Card.** Write `DC-NNN.md` to the bank the owner named (Share `project` unless the owner says `owner-wide`), then
   `node scripts/decisions.cjs lint <bank>` must exit 0.

## Rules
- Evidence over agreement. Mark uncertainty; "unknown" is a valid answer.
- A card is append-only once linted: changes are Status or Outcome lines, a reversal is a new card with Supersedes.
- At most 1 research subagent; never two agents on the same sources.

## Output (200 words or fewer)
Recommendation - confidence - why (criteria) - failure signal - similar card ids - arena offer line or none - card path.
