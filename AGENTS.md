# Agent Instructions

## Agent skills

### Issue tracker

Issues and Wayfinder maps/tickets are tracked in GitHub Issues for `gcat332/dnd`; external PRs are not treated as a triage request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo. Read `CONTEXT.md` at the repo root and ADRs under `docs/adr/` when relevant. See `docs/agents/domain.md`.

### Development skills

Use the repo skill profile in `docs/agents/dev-skills.md` to choose the right planning, design, implementation, testing, review, GitHub, and OpenAI API workflows.

At the start of work in a fresh checkout, if `dnd-project-dev`, `dnd-wayfinder`, `wayfinder`, or the other required skills are not installed in the local Codex skill directory, run `./scripts/bootstrap-agent-skills.sh` before continuing. This installs the bundled project and vendored skills from `skills/`.

### Cross-agent coordination

Other agents (Claude Code, Codex) may be working in this repo in a separate session at the same time. Check `AGENT_COORDINATION.md` at the repo root before starting work, and add/update an entry there when you start, pause, hand off, or finish a task so others can see what you're touching.
