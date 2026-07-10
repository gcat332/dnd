# DnD Browser Tabletop

A browser-based virtual tabletop for playing DnD-style campaigns with friends online. The target table is a scheduled live session for 4-6 signed-in players, using Discord for voice and the web app for maps, rules automation, character state, dice, logs, and campaign persistence.

This repository is currently in the wayfinding/design stage. The domain language captured so far lives in [CONTEXT.md](./CONTEXT.md).

Agent setup for continuing development lives in [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md), and [docs/agents](./docs/agents). A fresh machine still needs the required agent skills/plugins installed; see [docs/agents/skill-prerequisites.md](./docs/agents/skill-prerequisites.md).

## Product Direction

The project is a remote-first tabletop, not a video meeting app. Players join live sessions through the browser, play together on a shared square-grid battle map, and return later to saved campaign and session state.

Key decisions so far:

- Discord login is required for all players.
- Discord voice is used outside the app.
- The app keeps in-game text chat, dice rolls, combat events, rules warnings, overrides, and session history.
- Campaigns and individual sessions both save state.
- Meaningful session changes commit back to the campaign automatically.
- DM and player views are separate, with hidden information visible only to the DM.
- The battle map uses a square grid with movable tokens.
- The target realtime table size is 4-6 players, while still allowing multiple saved campaigns.

## V1 Scope

V1 is intended to be a playable MVP with limited starting content, not a content-complete clone of every official DnD book.

Planned V1 pillars:

- Campaign and session management with autosave and resume.
- DM view and player view with hidden information support.
- Square-grid tactical battle map with tokens.
- Advanced character sheets with stats, progression, abilities, spells, inventory, conditions, and derived values.
- SRD-compatible rules foundation plus original content.
- Tactical rules automation for movement, range, targeting, area effects, line of sight, conditions, concentration, resources, resistance, vulnerability, and combat timing.
- DM-configurable enforcement, allowing rules to be hard-blocked, warned with override, or advisory per campaign.
- Rules content editor for monsters, NPCs, items, spells, abilities, conditions, traits, resources, damage types, encounters, quests, maps, and notes.
- Procedural special ability generation using structured templates.
- AI-assisted ability generation with DM approval.
- AI campaign generation from story seeds, producing campaign drafts that the DM reviews and imports.

## Content And Licensing Direction

The rules/content direction is SRD-compatible plus original content. The project should use Creative Commons SRD material as a foundation and avoid relying on non-SRD proprietary DnD content.

Relevant reference:

- [D&D Beyond System Reference Document](https://www.dndbeyond.com/srd)

## Current Status

This is not implemented yet. The current repository contains the initial project README and domain glossary so the next step can create a Wayfinder map, tickets, and implementation plan without losing the product decisions already made.
