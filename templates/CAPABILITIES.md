# CAPABILITIES: logical tool name to real tool

Laws use the logical names. Map them here once per project with the capability probe (load schemas through ToolSearch, read-only). Anything not confirmed is UNKNOWN; never guess.

verified: {{date}}

| Logical name | Tool | Params | Notes |
|---|---|---|---|
| list_agents | `ListAgents` | none | peers, busy/idle/waiting |
| message | `SendMessage` | `to`, `message`, `summary`, `notify_when_idle` | the pinned messaging tool; `to` is the name from list_agents |
| spawn_task | `mcp__ccd_session__spawn_task` | `title`, `prompt`, `tldr`, `cwd` | makes a chip the human starts; no model param |
| clear_session | `mcp__ccd_session_mgmt__clear_session` | `session_id` = `self` or an idle session this session started | human approves each call; `self` clears when the turn ends |
| set_session_model | `mcp__ccd_session_mgmt__set_session_model` | `session_id`, `model` | refused for self; `model` must be a picker id |
| set_session_effort | `mcp__ccd_session_mgmt__set_session_effort` | `session_id`, `effort` low/medium/high/xhigh/max | refused for self |
| get_usage | `mcp__ccd_session_mgmt__get_usage` | `session_id` (default self) | plan windows with percentUsed and resetsAt; context tokens by category |
| list_sessions | `mcp__ccd_session_mgmt__list_sessions` | `group`, `include_archived`, `limit`, `linked` | |
| stop_session | `mcp__ccd_session_mgmt__stop_session` | `session_id` | registered workers only, human approves |
| fast_mode | `mcp__ccd_session_mgmt__set_session_fast_mode` | `enabled`, `session_id` | never use |
| subagent | `Agent` | `subagent_type`, `model` (the short names listed in MODELS.md), `prompt` | |
| schedule | `mcp__scheduled-tasks__create_scheduled_task` | `taskId`, `prompt`, `description`, `cronExpression` or `fireAt` | |
| connectors | `mcp__ccd_connectors__set_session_connector_enabled` | `connector`, `enabled` | status: `session_connectors_status` |

Verified 2026-10-05: the Agent tool accepts a model per call and the named model answered. A subagent result does not report its token use, so measure cost with get_usage (plan percent and context tokens) instead.

UNKNOWN: whether Master can start a spawn_task chip itself; the exact picker model ids for set_session_model.

Without the desktop app (plain CLI): spawn_task becomes a paste prompt (`core/LEGACY-INBOX.md`), clear and model switches become steps the human does, usage is reported by the human, scheduling becomes the human typing `resume`.
