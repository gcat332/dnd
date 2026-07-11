# Agent Coordination Log

Shared scratch log for the agents working in this repo (Claude Code, Codex) across separate sessions/processes. Not a source of truth — GitHub Issues (`gcat332/dnd`), `docs/superpowers/`, and `CONTEXT.md` remain canonical. This file exists only so one agent can tell what another is currently touching and avoid collisions or duplicate work.

Newest entry on top. Keep entries short.

When you start a task: add an entry with what you're touching (issue #, files, branch/worktree). When you pause, hand off, or finish: update the same entry's Status line rather than leaving it stale.

---

## 2026-07-11 — Claude Code

**Task**: GitHub #2 "Define the playable V1 boundary" (Wayfinder ticket, child of map #1)
**Status**: done — resolved via `wayfinder`/`grilling`, closed, map updated. Decisions: exact-fidelity session resume; hybrid event-driven autosave (Battle Map state + full Session Log persist, UI-only state doesn't); Discord login-only + app-native campaign invitations (no bot/guild scope); single transferable DM per campaign (only current DM can transfer); DM Prep workspace in V1 (async Battle Map editing + one-session "Session Plan"); deferred past V1: Discord guild integration, co-DM, batch import, multi-session timeline planner. Added `DM Prep`, `Session Plan`, `Campaign Invitation` to `CONTEXT.md`.
**Touched**: issue #2 (resolution comment + closed), issue #1 map body (Decisions-so-far, ticket checkbox, graduated one fog line), `CONTEXT.md`. No branch/worktree — plain-file edits on `main`, not yet committed.
**Handoff**: next frontier ticket per the map is #5 "Define the SRD-compatible content strategy" (unblocked) — not started, left for the next session per "one ticket per session."

---

## 2026-07-11 — Claude Code (2)

**Task**: GitHub #5 "Define the SRD-compatible content strategy" (Wayfinder ticket, child of map #1, `wayfinder:research`) — pivoted mid-ticket into a project rename/rebrand.
**Status**: done. Research on SRD 5.2.1 licensing (`docs/research/2026-07-11-srd-content-strategy.md`) led to a bigger decision: drop SRD content entirely, use only generic RPG mechanics + 100% original content. Project renamed **Taleforge**. V1 ships an original old-school JRPG/anime "hero vs. demon lord" starter campaign; AI Campaign Generator and Rules Content Editor stay setting-agnostic beyond that.
**Touched**: issue #5 (resolution comment + closed), issue #1 map (title renamed "Wayfinder: Taleforge V1", Destination/Notes/standing-decisions/Decisions-so-far/Tickets/fog all updated), `CONTEXT.md` (title, intro line, `SRD-compatible Ruleset` → `Original Ruleset`, `Homebrew Content` reworded), `docs/research/2026-07-11-srd-content-strategy.md` (new). Committed on `main`.
**Handoff**: repo/local-folder rename (`gcat332/dnd` → Taleforge branding) is flagged on the map as a separate not-yet-decided item — don't do it unilaterally. Concrete starter-content naming (world/demon lord/hero/class names) is fog, not yet a ticket. Frontier tickets now unblocked: #3 "Choose the first platform architecture" and #4 "Model campaigns sessions and rules data" (both were blocked only by #2/#5, now closed).

---

## 2026-07-11 — Claude Code (3)

**Task**: GitHub #3 "Choose the first platform architecture" (Wayfinder ticket, child of map #1, `wayfinder:grilling`)
**Status**: done. Decisions: Vite + React SPA extending the existing `prototypes/battle-map-renderer` stack (no meta-framework migration); Supabase for Postgres/Auth(Discord OAuth)/Realtime/Storage, chosen over Convex/custom-backend despite Supabase's free-tier pause-after-1-week-inactivity risk; realtime sync mixes Postgres Changes + Broadcast + Presence, with rules-affecting actions gated through a Supabase Edge Function (server-authority point for future Tactical Rules Automation, ticket #6).
**Touched**: issue #3 (resolution comment + closed), issue #1 map (Decisions-so-far, standing decisions, ticket checkbox, graduated one fog line). No CONTEXT.md changes this time (no new domain terms). Committed on `main`.
**Handoff**: next frontier ticket is #4 "Model campaigns sessions and rules data" (unblocked, no assignee). #9 "Design realtime session state and autosave" is still blocked — needs #4 closed too, not just #3.
