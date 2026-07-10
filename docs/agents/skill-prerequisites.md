# Skill Prerequisites

This repo documents the skill workflow and vendors the core project skills needed to continue planning and development. A person who pulls the repo can install those bundled skills into their local AI runtime skill directories with the bootstrap script.

The repo includes:

- `skills/project/*`: DnD project-specific skills.
- `skills/vendor/agents/*`: vendored planning and development skills.
- `skills/vendor/superpowers/*`: vendored superpowers workflow skills used by this repo.
- `skills/vendor/game-studios/*`: vendored UX/design skills (adapted from `donchitos/claude-code-game-studios` to be AI-agnostic).

Install them explicitly after pulling:

```bash
./scripts/bootstrap-agent-skills.sh
```

By default this installs into **both** Claude Code (`$CLAUDE_HOME/skills`, or `~/.claude/skills` when `CLAUDE_HOME` is unset) and Codex (`$CODEX_HOME/skills`, or `~/.codex/skills` when `CODEX_HOME` is unset), using symlinks. Restrict to one runtime with `--target claude` or `--target codex`. Use `--copy` if symlinks are not desired.

Agent instruction files (`AGENTS.md` and `CLAUDE.md`) tell agents to run this bootstrap script at the start of work in a fresh checkout when required skills are missing. This is intentionally explicit rather than a hidden `git pull` side effect.

Check what is missing without installing:

```bash
./scripts/bootstrap-agent-skills.sh --check-only
```

## Required for Wayfinder planning

- `wayfinder`
- `grilling`
- `domain-modeling`
- `research`
- `prototype`
- `to-spec`
- `to-tickets`

These are vendored under `skills/vendor/agents` and used to maintain the GitHub Issues map, resolve planning tickets, keep `CONTEXT.md` accurate, and turn decisions into specs or tickets.

## Required for implementation

- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `implement`
- `superpowers:test-driven-development` or `tdd`
- `diagnosing-bugs` or `superpowers:systematic-debugging`
- `superpowers:verification-before-completion`
- `codebase-design`
- `design-an-interface`
- `code-review` or `superpowers:requesting-code-review`

Most of these are vendored under `skills/vendor/agents` or `skills/vendor/superpowers`. They cover feature design, implementation plans, rules-engine testing, debugging, verification, and code review.

## Required for GitHub workflow

- GitHub plugin skills:
  - `github:github`
  - `github:yeet`
  - `github:gh-fix-ci`
  - `github:gh-address-comments`
- Local tools:
  - `git`
  - `gh` authenticated against `gcat332/dnd`

These support issue reads/writes, Wayfinder map/tickets, commits, pushes, PRs, CI fixes, and review comments.

## Required for AI features

- `openai-developers:openai-platform-api-key`
- `openai-docs`
- `openai-developers:openai-api-troubleshooting`

Use these before implementing, configuring, running, or debugging OpenAI API-backed campaign or ability generation.

## Optional UX and design skills

Vendored under `skills/vendor/game-studios` and installed by the bootstrap script. Use them once UI and rules-feature design work begins:

- `ux-design`: author a UX spec for a screen, flow, or app chrome.
- `ux-review`: validate a UX spec before implementation.
- `feature-design`: author a structured design doc for a feature or rules system.
- `quick-design`: lightweight design spec for a small change.
- `design-review`: review a feature/design doc before implementation.

## Optional later

- `setup-pre-commit`: add once the JavaScript/TypeScript stack exists.
- Figma skills: use only if the project starts pushing designs to Figma or implementing from Figma.
- Sites connector: use only if deploying a web artifact through OpenAI Sites.

## Fresh checkout checklist

1. Pull the repo.
2. Confirm `gh auth status` works.
3. Run `./scripts/bootstrap-agent-skills.sh`.
4. Confirm the agent can read `AGENTS.md` or `CLAUDE.md`.
5. Confirm the bundled skills listed above are available in the agent environment.
6. Read `CONTEXT.md`, `docs/agents/dev-skills.md`, and the open Wayfinder map before starting work.

If a required skill is missing, install it into the agent environment or use the closest available workflow and document the gap in the GitHub issue you are working on.
