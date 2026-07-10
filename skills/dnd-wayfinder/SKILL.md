---
name: dnd-wayfinder
description: Use when continuing Wayfinder planning for the gcat332/dnd DnD browser tabletop repo, especially when reading or resolving GitHub Issues #1-#9.
---

# DnD Wayfinder

This is a repo-local companion skill. Prefer the full `wayfinder` skill when it is available; use this file as the project-specific checklist.

## Map

The Wayfinder map is GitHub issue #1: `Wayfinder: DnD browser tabletop V1`.

Open it before choosing work:

```bash
gh issue view 1 --comments
```

## Ticket Rules

- Resolve at most one Wayfinder ticket per session.
- If a ticket has `Blocked by: #...`, do not work it until blockers are closed.
- Claim before working:

```bash
gh issue edit <number> --add-assignee @me
```

- Record the answer as an issue comment, close the ticket, then update issue #1 `Decisions so far`.
- Add new tickets when a resolved answer makes fog specifiable.

## Initial Frontier

The first unblocked tickets are:

- #2 `Define the playable V1 boundary`
- #5 `Define the SRD-compatible content strategy`

## Skills to Combine

- Use `grilling` for human product/scope decisions.
- Use `research` for SRD, licensing, platform, OAuth, realtime, and AI documentation.
- Use `domain-modeling` when terms or boundaries change.
- Use `prototype` when a concrete artifact would clarify a decision.
