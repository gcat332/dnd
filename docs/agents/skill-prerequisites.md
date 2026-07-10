# Skill Prerequisites

This repo documents the skill workflow, but it does not vendor or auto-install external agent skills. A person who pulls the repo can continue smoothly only if their agent environment has the needed skills/plugins available.

## Required for Wayfinder planning

- `wayfinder`
- `grilling`
- `domain-modeling`
- `research`
- `prototype`
- `to-spec`
- `to-tickets`

These are used to maintain the GitHub Issues map, resolve planning tickets, keep `CONTEXT.md` accurate, and turn decisions into specs or tickets.

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

These cover feature design, implementation plans, rules-engine testing, debugging, verification, and code review.

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

## Optional later

- `setup-pre-commit`: add once the JavaScript/TypeScript stack exists.
- Figma skills: use only if the project starts pushing designs to Figma or implementing from Figma.
- Sites connector: use only if deploying a web artifact through OpenAI Sites.

## Fresh checkout checklist

1. Pull the repo.
2. Confirm `gh auth status` works.
3. Confirm the agent can read `AGENTS.md` or `CLAUDE.md`.
4. Confirm the skills listed above are available in the agent environment.
5. Read `CONTEXT.md`, `docs/agents/dev-skills.md`, and the open Wayfinder map before starting work.

If a required skill is missing, install it into the agent environment or use the closest available workflow and document the gap in the GitHub issue you are working on.
