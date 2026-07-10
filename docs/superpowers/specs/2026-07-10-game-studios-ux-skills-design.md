# Vendor game-studios UX/design skills, AI-agnostic

> **Status**: Approved for implementation
> **Date**: 2026-07-10
> **Source**: `donchitos/claude-code-game-studios`

## Goal

Add a small, curated set of UX/design authoring-and-review skills to this repo,
adapted from the `claude-code-game-studios` template. The imported skills must be
**AI-agnostic** (usable by Claude Code, Codex/OpenAI, and other harnesses the way
the repo's existing vendored skills are) and **reframed for a browser web app**
(this repo), not a game engine.

This closes a real gap: the repo currently has **no UI/UX design skill** — the dev
skill profile only mentions Figma and generic "frontend guidance".

## Non-goals

- Not importing the full template (49 agents, 12 hooks, rules, engine reference).
- Not importing skills that duplicate existing vendored ones (`brainstorm`,
  `code-review`, architecture, `dev-story`, `prototype`, qa, bug — already covered).
- Not building a real UI design-token/component system skill (that would be net-new
  authoring, out of scope here).

## Scope: five skills

| Source skill | Vendored as | Purpose (web-app framing) | Artifact |
|---|---|---|---|
| `ux-design` | `ux-design` | Author a UX spec for a screen / flow / app chrome (map view, character sheet, DM & player views, dice tray, session log) | `docs/design/ux/<name>.md` |
| `ux-review` | `ux-review` | Review a UX spec: completeness / accessibility / implementation-readiness → verdict APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED (read-only) | none (report) |
| `design-system` | **`feature-design`** (renamed) | Author a structured design doc for one feature/system: overview, user goal, behavior, **formulas, edge cases**, dependencies, tuning, acceptance criteria — fits the DnD rules engine (movement, line-of-sight, concentration) | `docs/design/features/<name>.md` |
| `design-review` | `design-review` | Review any design/spec doc for completeness, internal consistency, implementability (read-only) | none (report) |
| `quick-design` | `quick-design` | Lightweight one-pass design for a small change/feature | `docs/design/quick-specs/<name>-<date>.md` |

**Rename rationale**: game-studios `design-system` is section-by-section authoring of
a single *game system* GDD (not a UI design system of tokens/components as the name
implies). Its structure — formulas, edge cases, tuning knobs, acceptance criteria —
maps cleanly onto DnD rules features, so it is renamed `feature-design` to match what
it actually does.

## The "common" transformation (AI-agnostic adaptation rules)

Applied to every imported skill. This is what "make it work with all AI" means here.

1. **Frontmatter** reduced to `name` + `description` only, matching the repo's
   vendored skills. Drop `argument-hint`, `user-invocable`, `allowed-tools`, `model`,
   `agent`. Rewrite the `description` in web-app terms.
2. **Remove Claude-only orchestration**: strip `agent: <specialist>`, "spawn via the
   Task tool", `.claude/docs/director-gates.md`, `production/review-mode.txt`, review
   modes, and "engine specialist" routing. Rewrite as single-agent inline instructions
   ("do this analysis yourself; if your runtime supports parallel subagents you *may*
   delegate, but it is never required").
3. **Neutralize `AskUserQuestion`**: replace with runtime-neutral "ask the user"
   phrasing (present the options as plain text and wait for a choice). Codex/OpenAI
   has no `AskUserQuestion` tool.
4. **De-game the domain**: GDD → design doc / UX spec; "game concept / player fantasy"
   → product intent & user goal; HUD → app UI / persistent chrome; "systems" →
   features/modules; drop engine/shader/asset content. Reframe examples around the
   DnD browser tabletop.
5. **Inline the templates**: fold the skeletons the source pulls from
   `.claude/docs/templates/` (`ux-spec.md`, `hud-design.md`,
   `interaction-pattern-library.md`, `game-design-document.md`) directly into the
   SKILL body so there is no external template dependency.
6. **Add `agents/openai.yaml`** per skill (`interface.display_name` +
   `interface.short_description`) exactly like the repo's `skills/vendor/superpowers/*`
   skills, so the skill surfaces under the Codex/OpenAI runtime.
7. **Repo-appropriate output paths**: write artifacts under `docs/design/**`, not
   `design/gdd/` or `design/ux/`. No dependency on `production/session-state/`.
8. **Preserve the collaborative core**: keep section-by-section authoring, incremental
   writing, cross-reference checks, and verdict formats — these are the actual value.

## Landing & wiring

- Skills land at `skills/vendor/game-studios/<skill>/SKILL.md` (+ `agents/openai.yaml`).
- Add the five skill names to `scripts/bootstrap-agent-skills.sh` `OPTIONAL_SKILLS`.
- `docs/agents/dev-skills.md`: add a "UX and product design" subsection listing them
  under Frontend and experience.
- `docs/agents/skill-prerequisites.md`: note them as optional UX/design skills.

## Gap #3: dual-install bootstrap (Claude Code + Codex)

The bootstrap currently installs only to `$CODEX_HOME/skills`, despite the repo
claiming multi-AI support and shipping `CLAUDE.md`. Fix:

- Add `--target claude|codex|both` (default `both`).
- Claude target dir: `${CLAUDE_HOME:-$HOME/.claude}/skills`.
- Codex target dir: `${CODEX_HOME:-$HOME/.codex}/skills` (unchanged).
- `--check-only` reports which target dirs already have each skill.
- Update `README.md`, `docs/agents/skill-prerequisites.md`, `AGENTS.md`/`CLAUDE.md`
  wording so "install the bundled skills" reflects both runtimes.

## Acceptance criteria

- [ ] Five skills exist under `skills/vendor/game-studios/`, each with `SKILL.md`
      (minimal `name`+`description` frontmatter) and `agents/openai.yaml`.
- [ ] No imported skill references `Task`/`AskUserQuestion`/`agent:`/`.claude/`/
      `production/`/`GDD`/engine/shader/HUD-as-game — grep-clean.
- [ ] `design-system` is renamed to `feature-design` (name + directory + description).
- [ ] Skill bodies reference `docs/design/**` output paths and DnD web-app examples.
- [ ] `bootstrap-agent-skills.sh` installs to both `~/.claude/skills` and
      `~/.codex/skills` by default; `--target` selects one; `--check-only` works;
      the five skills appear in `OPTIONAL_SKILLS`.
- [ ] `dev-skills.md`, `skill-prerequisites.md`, and `README.md` document the new
      skills and dual-install.
- [ ] `./scripts/bootstrap-agent-skills.sh --check-only` runs clean and lists the
      five new skills.
