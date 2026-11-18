# Decide

One recommendation for a hard question, with the evidence, a confidence and the signal that would prove it wrong.
Arena rules: `procedure/05-arena-and-decisions.md`. Cost without arena: about 1 research subagent.

## Steps
1. **Research.** `research <question> quick` on studies and on how others decided (public sources only). Standard
   depth only if confidence is under 60. Put no project data in queries.
2. **History.** `node <skill_dir>/scripts/decisions.cjs find <master_dir>/ACTION_LOG.md <keywords>`: the top 3 similar
   DL entries (ids and titles, no model tokens). Cite a similar entry by id.
3. **Close or High-risk?** Two options within 10% on the weighted criteria, confidence 60 or less, or risk tier High:
   run `decisions.cjs preflight` phase A (procedure/05) and offer arena with the 43-call line. Offer only; never start
   it. If the usage item fails, say "no arena: usage".
4. **Recommend.** One option, confidence 0-100, the criteria scores, and the failure signal that would prove it wrong.
5. **Log.** Append a DL entry (`templates/ACTION_LOG.md`, Type Architecture-Decision) with Confidence, Review-by and
   Failure-signal, then `node <skill_dir>/scripts/decisions.cjs lint <master_dir>/ACTION_LOG.md` must exit 0.

## Rules
- Evidence over agreement. Mark uncertainty; "unknown" is a valid answer.
- An entry is append-only: changes are Outcome lines, a reversal is a new entry with Supersedes.
- At most 1 research subagent; never two agents on the same sources.

## Output (200 words or fewer)
Recommendation - confidence - why (criteria) - failure signal - similar DL ids - arena offer line or none - DL id.
