# master-brain — a Claude Code skill for running a Master chat plus Worker chats

Type `/master-brain` and that chat becomes a **Master**: it plans every task, picks the cheapest way to do each piece, runs worker chats in their own git worktrees, keeps append-only history files so any chat can resume, and reports to you. It works in any project. On first run it onboards the project.

It is built to spend few tokens: a 2k-token boot, scripts that do the mechanical work, tiered models and effort, short fixed-format briefs and results, and five helper modules bundled inside the skill (read only when used).

## Install

```bash
git clone https://github.com/basilalias0/master-brain-skill.git ~/.claude/skills/master-brain
node ~/.claude/skills/master-brain/scripts/verify.cjs ~/.claude/skills/master-brain
```

On Windows the folder is `%USERPROFILE%\.claude\skills\master-brain`. Update with `/master-brain update` (fast-forward only, asks first). Needs Node 18 or newer and git. No other dependencies, no network use except cloning a skill you approved.

## Use

| Type | Does |
|---|---|
| `/master-brain` or `resume` | Boot as Master (or onboard a new project), report status |
| `status` | 15-line snapshot from `STATE.md` and `BOARD.md` |
| `onboard` | First run on a project |
| `models` | Show the tier table (`MODELS.md`) |
| `research <q> [quick|standard|deep]` | module: research |
| `lean [lite|full|ultra]` | module: minimal-change mode |
| `developer [build|update]` | module: developer |
| `analyze <target>` | module: analyzer (read-only) |
| `test [report|implement]` | module: tester |
| `audit [quick|standard|deep] [scope]` | security-audit (third party, optional) |
| `help [name]` | Lists every module and subcommand (no model tokens) |

## Modules are bundled

The five helpers (research, lean, developer, analyzer, tester) ship inside this skill as modules, read only when used. Only the optional third-party security-audit skill installs on demand, after you say yes, from `registry.json` at a pinned commit.

## Files

| Path | What |
|---|---|
| `SKILL.md` | the router (boot, subcommands, install on demand) |
| `PROCEDURE.md`, `procedure/` | the build, test, regress, log cycle |
| `ONBOARDING.md` | first run on a project |
| `core/` | PRECEDENCE, SAFETY, TOKENS, BRIEF, RESULT, LEGACY-INBOX |
| `templates/` | LAWS, MODELS, CAPABILITIES |
| `scripts/` | zero-token helpers (Node, no dependencies, each with a test) |
| `modules/` | research, lean, developer, analyzer, tester (each `MODULE.md` + `HELP.md`) |
| `budget.json` | size caps; a cap may not rise without a measured gain |
| `registry.json` | third-party skills it may install (none bundled) |
| `VERSION`, `CHANGELOG.md`, `RELEASING.md` | versioning and the maintainer release gate |

Per-project state lives in `<project>/master-brain/`, never in this repo. Keep that folder out of the project's git; master-brain treats a tracked one as untrusted.

## Learning from your project

Every finished task is logged in `<project>/master-brain/routing-log.jsonl`. `/master-brain improve` turns the log into proposals (routing, local-rule, generic) with evidence; nothing changes without your yes. Approved project rules go to `<project>/master-brain/overlay/` (capped, one file per module, never able to relax safety or tests). The installed skill is never edited. `/master-brain contribute` writes a sanitized export of rules you mark general; you send it yourself. Only maintainers with write access push this repo; master-brain never does.

## Languages: verified and not

Verified by running here: JS/TS (Node) and Python. Go, Java/Kotlin, Rust, C#, Ruby and PHP are covered by the test guard and `modules/tester/frameworks.md`, but only pattern-tested on snippets, never run. The skill says "not run" when a toolchain is missing.

## Tools it uses, and the fallback without them

Laws name tools logically; `templates/CAPABILITIES.md` maps them. In the Claude desktop app everything is available. In the plain CLI:

| Capability | Without it |
|---|---|
| spawn a worker | Master drafts a paste-prompt (`core/LEGACY-INBOX.md`) |
| clear a session | you clear it |
| switch model or effort | you switch it; Master tells you which |
| usage | you tell Master the 5-hour percentage |
| scheduled resume | you type `/master-brain resume` |

## Credits

The optional security-audit skill is third-party work by Cloudflare, MIT licensed. master-brain does not bundle or install it; get it from its own upstream repository and keep its license.
