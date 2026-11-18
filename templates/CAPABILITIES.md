# CAPABILITIES: logical tool name to real tool

Laws use the logical names. Map them here once per project with the capability probe (load schemas through ToolSearch, read-only). Anything not confirmed is UNKNOWN; never guess.

verified: {{date}}

| Logical name | Tool | Params | Notes |
|---|---|---|---|
| list_agents | `ListAgents` | none | peers, busy/idle/waiting |
| message | `SendMessage` | `to`, `message`, `summary`, `notify_when_idle` | the pinned messaging tool; `to` is the name from list_agents. The session-management send tool is deprecated. A peer in another permission mode may hold messages, so silence is not agreement: no answer after 1 cycle = `blocked`, never assume yes |
| spawn_task | `mcp__ccd_session__start_session` | `initiation`, `title`, `prompt`, `background` (fresh), `context` fresh/fork, `use_worktree`, `model`, `effort`, `name`, `wake_when_done` | starts a worker session and returns its id. `user_asked` only under the human's words (an approved scale plan's worker count: quote it); else `own_initiative`, a card the human starts. `model` and `effort` at or below this chat's. Replaced `spawn_task` (gone 2026-11-18) |
| clear_session | `mcp__ccd_session_mgmt__clear_session` | `session_id` = `self` or an idle session this session started | human approves each call; `self` clears when the turn ends; a worker uses it only after the Master's `RESET`; another chat is refused unless this session started it |
| set_session_model | `mcp__ccd_session_mgmt__set_session_model` | `session_id`, `model` | refused for self; `model` must be a picker id; no prompt for a session this chat started when the model is the same or cheaper |
| set_session_effort | `mcp__ccd_session_mgmt__set_session_effort` | `session_id`, `effort` low/medium/high/xhigh/max | refused for self |
| get_usage | `mcp__ccd_session_mgmt__get_usage` | `session_id` (default self) | plan windows with percentUsed and resetsAt; context tokens by category |
| list_sessions | `mcp__ccd_session_mgmt__list_sessions` | `group`, `include_archived`, `limit`, `linked` | |
| unarchive_session | `mcp__ccd_session_mgmt__unarchive_session` | `session_id` | Chief only: brings back an owning Master the host archived, before routing work to it (`core/CHIEF.md` rule 10); the app asks the human per call |
| archive_session | `mcp__ccd_session_mgmt__archive_session` | `session_id` | after a rollover only: the old Chief or Master chat, once every Master has the new id (`core/CHIEF.md` rule 1) |
| delete_session | `mcp__ccd_session_mgmt__delete_session` | `session_id` | as archive_session, only when law 12 says `old chats: delete`; cannot be undone; never any other chat |
| stop_session | `mcp__ccd_session_mgmt__stop_session` | `session_id` | registered workers only, human approves |
| fast_mode | `mcp__ccd_session_mgmt__set_session_fast_mode` | `enabled`, `session_id` | never use |
| subagent | `Agent` | `subagent_type`, `model` (the short names listed in MODELS.md), `prompt`, `isolation: "worktree"`, `run_in_background` | `isolation: "worktree"` is required whenever the agent edits files (one worktree per worker, law 2); read-only scouts omit it |
| schedule | `mcp__scheduled-tasks__create_scheduled_task` | `taskId`, `prompt`, `description`, `cronExpression` or `fireAt` | |
| get_session | `mcp__ccd_session_mgmt__get_session` | `session_id` (or `self`) | metadata only (status, model, worktree, branch); read it first |
| list_events | `mcp__ccd_session_mgmt__list_events` | `session_id`, `limit`, `before_uuid` | a chat's transcript; costly, not on the overdue path (read the worker's handoff LAST block, then message it) |
| sync_base | `mcp__ccd_host__sync_with_base_branch` | `base`, `folder`, `abort` | merges the base into this worktree instead of `git merge`/`pull`; conflicts are left for the worker to resolve and commit; nothing is pushed. UNKNOWN until the probe confirms it on this host; until then the worker returns `needs-master` |
| dismiss_task | `mcp__ccd_session__dismiss_task` | `task_id`, `reason` | withdraws a stale chip; only chips this chat made |
| connectors | `mcp__ccd_connectors__set_session_connector_enabled` | `connector`, `enabled` | status: `session_connectors_status` |

Verified 2026-10-05: the Agent tool accepts a model per call and the named model answered. A subagent result does not report its token use, so measure cost with get_usage (plan percent and context tokens) instead.

Verified 2026-11-18: `start_session` is on the desktop host and starts sessions itself (see the spawn_task row).

UNKNOWN: the exact picker model ids for set_session_model.

Probe check (no model tokens): copy the tool names from the loaded and deferred lists, one per line, to `<master_dir>/caps/tools-YYYY-MM-DD.txt`, then `node <skill_dir>/scripts/caps.cjs diff CAPABILITIES.md <that file>`. Exit 1 lists `missing:` or `unmapped:` tools: map each or mark it UNKNOWN. `Workflow`, `Monitor`, `ScheduleWakeup` and `PushNotification` are used by their real names and need no row.

Without the desktop app (plain CLI): spawn_task becomes a paste prompt (`core/LEGACY-INBOX.md`), clear and model switches become steps the human does, usage is reported by the human, scheduling becomes the human typing `resume`.
