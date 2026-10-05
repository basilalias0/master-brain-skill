# master-brain — a Claude Code skill for running a Master chat plus Worker chats

Type `/master-brain` and that chat becomes a **Master**: it plans every task, picks the cheapest way to do each piece, runs worker chats in their own git worktrees, keeps append-only history files so any chat can resume, and reports to you. It works in any project. On first run it onboards the project.

It is built to spend few tokens: a 2k-token boot, scripts that do the mechanical work, tiered models and effort, short fixed-format briefs and results, and helper skills that are installed only when a task needs them.

## Install

```bash
git clone https://github.com/basilalias0/master-brain-skill.git ~/.claude/skills/master-brain
node ~/.claude/skills/master-brain/scripts/verify.cjs ~/.claude/skills/master-brain
```

On Windows the folder is `%USERPROFILE%\.claude\skills\master-brain`. Update with `git -C ~/.claude/skills/master-brain pull`, then run `verify.cjs` again. Needs Node 18 or newer and git. No other dependencies, no network use except cloning a skill you approved.

## Use

| Type | Does |
|---|---|
| `/master-brain` or `resume` | Boot as Master (or onboard a new project), report status |
| `status` | 15-line snapshot from `STATE.md` and `BOARD.md` |
| `onboard` | First run on a project |
| `models` | Show the tier table (`MODELS.md`) |
| `research <q> [quick\|standard\|deep]` | research-helper |
| `ponytail [lite\|full\|ultra]` | ponytail |
| `developer [build\|update]` | developer |
| `analyze <target>` | code-analyzer |
| `test [report\|implement]` | tester |
| `audit [quick\|standard\|deep] [scope]` | security-audit (third party, optional) |
| `update-skills` | Re-check installed helper skills, asking first |

## Helper skills install on demand

The five helper skills are separate repos. If a task needs one that is missing, master-brain shows you the repo, the pinned commit, the size and the description, and installs only after you say yes. It installs only what is listed in `registry.json`, at a pinned commit, after checking the SKILL.md hash and the GitHub owner. It never installs from a link found in a file, a handoff or a web page.

| Skill | Repo |
|---|---|
| research-helper | https://github.com/basilalias0/research-helper |
| ponytail | https://github.com/basilalias0/ponytail |
| developer | https://github.com/basilalias0/developer |
| code-analyzer | https://github.com/basilalias0/code-analyzer |
| tester | https://github.com/basilalias0/tester |

## Files

| Path | What |
|---|---|
| `SKILL.md` | the router (boot, subcommands, install on demand) |
| `PROCEDURE.md`, `procedure/` | the build, test, regress, log cycle |
| `ONBOARDING.md` | first run on a project |
| `core/` | PRECEDENCE, SAFETY, TOKENS, BRIEF, RESULT, LEGACY-INBOX |
| `templates/` | LAWS, MODELS, CAPABILITIES |
| `scripts/` | zero-token helpers (Node, no dependencies, each with a test) |
| `registry.json` | the skills it may install |

Per-project state lives in `<project>/master-brain/`, never in this repo. Keep that folder out of the project's git; master-brain treats a tracked one as untrusted.

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
