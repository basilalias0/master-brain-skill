# analyzer help

Purpose: read-only map of what a change touches, plus anti-patterns and a light security pass.
Use: `/master-brain analyze <file, module or planned change>`. It never edits or runs code.
Output: dependency map, blast radius, top 10 findings with confidence, a 3-line verdict.
Example: `/master-brain analyze "change applyDiscount signature"`
