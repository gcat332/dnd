# Development Skill Profile

This repo is a large browser tabletop project with realtime collaboration, rules automation, content editing, and AI-assisted generation. Use these skills deliberately instead of improvising the workflow.

For a fresh checkout, first verify or install the bundled skills described in `docs/agents/skill-prerequisites.md`.

Project and vendored skills can be installed with:

```bash
./scripts/bootstrap-agent-skills.sh
```

## Planning and product discovery

- `wayfinder`: Use for the overall project map and large unclear chunks of work. One session should chart or resolve at most one Wayfinder ticket.
- `grilling`: Use for human decisions that shape product behavior, rules boundaries, UX tradeoffs, or scope.
- `domain-modeling`: Use whenever a project term becomes canonical or a term in `CONTEXT.md` needs to change.
- `research`: Use for external documentation and licensing questions, especially SRD, OAuth, realtime infrastructure, hosting, and AI API details.
- `prototype`: Use when a decision needs a quick concrete artifact, such as a UI sketch, rules flow, encounter editor shape, or state model.

## Design and architecture

- `superpowers:brainstorming`: Use before designing new features or modifying behavior.
- `superpowers:writing-plans`: Use after an approved design when creating an implementation plan.
- `design-an-interface`: Use for deep module interfaces such as the rules engine, content schema, realtime session state, or AI generation boundary.
- `codebase-design`: Use when shaping module boundaries, dependency direction, or testable interfaces.
- `domain-modeling`: Use with architecture work whenever domain language changes.

## Implementation and testing

- `implement`: Use for executing a scoped ticket or approved plan.
- `superpowers:test-driven-development` or `tdd`: Use for rules engine, dice/math, combat automation, persistence, and permission logic.
- `diagnosing-bugs` or `superpowers:systematic-debugging`: Use before fixing failing behavior or test failures.
- `superpowers:verification-before-completion`: Use before claiming work is complete, before commits, and before PRs.
- `setup-pre-commit`: Use once the stack is chosen and package tooling exists.

## Frontend and experience

- `prototype`: Use for rough flows before committing to UI structure.
- `ux-design`: Use to author a UX spec for a specific screen, flow, or the persistent app chrome (map view, character sheet, DM/player views, dice tray, session log). Writes to `docs/design/ux/`.
- `ux-review`: Use to validate a UX spec for completeness, accessibility, and implementation readiness before building the screen.
- `figma:figma-generate-design` / `figma:figma-use`: Use only when pushing designs into Figma or working from a Figma file.
- Apply the frontend guidance in the agent instructions: build the actual app experience first, keep operational tools dense and usable, and verify responsive layouts.

## Feature and rules design

- `feature-design`: Use to author a structured design doc for one feature or rules system (movement, line-of-sight, concentration, initiative, a content editor) with formulas, edge cases, tuning knobs, and acceptance criteria. Writes to `docs/design/features/`. This is the heavyweight path.
- `quick-design`: Use for a small change — a tuning value, a minor tweak, or a small self-contained feature — where a full `feature-design` doc is overkill. Writes to `docs/design/quick-specs/`.
- `design-review`: Use before handing a feature/design doc to implementation to check completeness, consistency, and implementability. Prefer running it in a fresh session so the reviewer is independent of the authoring context.

These five (`ux-design`, `ux-review`, `feature-design`, `quick-design`, `design-review`) are vendored under `skills/vendor/game-studios` and adapted to be AI-agnostic; they are optional and installed by the bootstrap script.

## GitHub and delivery

- `github:yeet`: Use when publishing local changes to GitHub with commit/push/PR flow.
- `github:gh-fix-ci`: Use when GitHub Actions checks fail.
- `github:gh-address-comments`: Use when addressing PR review threads.
- `code-review` or `superpowers:requesting-code-review`: Use before merging major feature work.
- `resolving-merge-conflicts`: Use for in-progress merge or rebase conflicts.

## AI and OpenAI API work

- `openai-developers:openai-platform-api-key`: Use before implementing, running, testing, or configuring any app code that calls the OpenAI API. Do not inspect or print plaintext API keys.
- `openai-docs`: Use for current official OpenAI API, model, and product documentation.
- `openai-developers:openai-api-troubleshooting`: Use when OpenAI API calls fail.

## Documentation and project records

- `to-spec`: Use when turning a conversation into a GitHub issue/spec.
- `to-tickets`: Use when breaking an approved plan into tracer-bullet issues.
- `post-mortem`: Use after a meaningful bug fix lands.
- `ubiquitous-language`: Use when a broader glossary pass is needed.

## Default development flow

1. Use `wayfinder` for big unclear work.
2. Resolve one frontier ticket at a time.
3. Use `brainstorming` for feature design and get approval.
4. Write a plan with `writing-plans`.
5. Implement with tests.
6. Verify before completion.
7. Commit/push using the GitHub workflow.
