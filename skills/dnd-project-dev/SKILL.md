---
name: dnd-project-dev
description: Use when working in the gcat332/dnd repository on the DnD browser tabletop product, including planning, implementation, issues, rules automation, realtime state, content editing, or AI generation.
---

# DnD Project Development

## First Reads

Before acting in this repo, read:

- `AGENTS.md` or `CLAUDE.md`
- `CONTEXT.md`
- `docs/agents/dev-skills.md`
- `docs/agents/skill-prerequisites.md`
- `docs/agents/issue-tracker.md`

For Wayfinder work, open GitHub issue #1 first.

## Operating Rules

- Use GitHub Issues as the planning and ticket surface.
- Keep domain terms aligned with `CONTEXT.md`; update it when terms change.
- Treat V1 as a playable MVP with limited content, not a content-complete DnD clone.
- Keep the rules/content direction SRD-compatible plus original content.
- Do not implement OpenAI API calls until the OpenAI API key workflow has been handled safely.
- Verify before claiming completion, committing, pushing, or closing tickets.

## Default Flow

1. If the work is unclear or large, use `wayfinder` and resolve one frontier ticket.
2. If the work changes behavior, use design/brainstorming before implementation.
3. For rules, combat, persistence, permissions, or generation logic, use tests first.
4. Commit and push intentional, scoped changes.
