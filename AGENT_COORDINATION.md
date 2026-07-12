# Agent Coordination Log

Shared scratch log for the agents working in this repo (Claude Code, Codex) across separate sessions/processes. Not a source of truth — GitHub Issues (`gcat332/dnd`), `docs/superpowers/`, and `CONTEXT.md` remain canonical. This file exists only so one agent can tell what another is currently touching and avoid collisions or duplicate work.

Newest entry on top. Keep entries short.

When you start a task: add an entry with what you're touching (issue #, files, branch/worktree). When you pause, hand off, or finish: update the same entry's Status line rather than leaving it stale.

---

## 2026-07-12 — Codex (Controlled Orbit Camera implementation)

**Task**: execute
`docs/superpowers/plans/2026-07-12-controlled-orbit-camera-extension.md`
with subagent-driven development.
**Status**: in progress.
**Touching**: `.worktrees/controlled-orbit-camera` on
`feat/controlled-orbit-camera`; camera/store/scene/harness/e2e files listed in
the plan. Token persistence and terrain authoring contracts are not in scope.

---

## 2026-07-12 — Codex (controlled orbit and character planning)

**Task**: write separate implementation plans for the approved 360-degree
Controlled Orbit camera extension and JRPG Character vertical slice.
**Status**: done. Added both plans, aligned the Battle Map glossary with the
adjustable orthographic view, and wrote no application code.
**Touching**: `CONTEXT.md`, `docs/superpowers/plans/`, and camera/character
design references only; no application code during planning.

---

## 2026-07-12 — Claude Code (SESSION WRAP-UP / current state of the whole project)

**Everything below this entry is history.** This is the single "where are we" snapshot — read it first.

**Repo state**: `main` is pushed to `origin` (`e690f85`), working tree clean, no open worktrees/branches. Local Supabase stack stopped; Docker Desktop quit. App lives at `app/` (Vite + React 19 + Three.js/R3F + Supabase). `npm test` = 138/138, `npm run build` clean. Integration tests (`npm run test:db`) need Docker + `npx supabase start` first.

**Planning (Wayfinder map, GitHub issue #1): COMPLETE.** All 9 tickets (#2–#9) closed. Project rebranded **Taleforge** (dropped SRD entirely, uses only generic RPG mechanics + 100% original content; V1 starter theme = old-school JRPG "hero vs. demon lord"). Full decision index is in issue #1's "Decisions so far".

**Implementation shipped (2 of ~8 subsystems):**
1. **Foundation** — Discord OAuth login, `campaigns`/`campaign_memberships`/`campaign_invitations` schema + RLS + `SECURITY DEFINER` RPCs, create/invite/join Campaign UI. Plan: `docs/superpowers/plans/2026-07-11-taleforge-foundation.md`.
2. **Battle Map Integration** — `battle_maps` table (Campaign-scoped, DM-only RPC), list/create UI on the campaign dashboard, `/campaigns/:id/maps/:mapId` route mounting the real 3D `BattleMapScene` (empty — no terrain/token data yet). Plan: `docs/superpowers/plans/2026-07-11-taleforge-battle-map-integration.md`.

**Architecture conventions established (follow these in future subsystem plans):**
- Reads via RLS (`is_campaign_member(campaign_id)`); writes via `SECURITY DEFINER` Postgres RPC gateway (never direct client insert). Rules-affecting *gameplay* actions will use a Supabase Edge Function — a separate, not-yet-built mechanism (issues #6/#9).
- Every new migration is append-only and MUST include its own inline `GRANT`s to `authenticated` (a hosted Supabase project revokes Data API privileges by default — learned the hard way in Foundation, applied cleanly in `0003`).
- New integration test files: keep `fileParallelism: false` (shared local GoTrue container races otherwise).
- UI error handling: try/catch → `setError` → `.error-message` on BOTH create-paths and load-paths (a load-path miss regressed once and was caught in review — don't repeat).
- Battle Map coordinate space is a fixed global `MAP_SIZE_CELLS = 200`; no per-map dimension columns.

**KNOWN GAPS needing a human (not code — cannot be done in an automated session):**
1. **Discord OAuth app** not set up. `handle_new_user` trigger's `discord_username` mapping (`raw_user_meta_data -> 'custom_claims' ->> 'global_name'`) is an UNVERIFIED guess — after a first real Discord sign-in, check the actual payload and fix via a follow-up migration if wrong (`0001_campaign_foundation.sql` has a comment about this).
2. **Hosted Supabase project** not set up — app currently points at the local stack via `app/.env.local`.
3. **Repo/folder rename** `gcat332/dnd` → Taleforge branding — flagged repeatedly, high-blast-radius, needs explicit sign-off.

**Deferred/non-blocking tech debt (tracked, safe to leave):**
- `BattleMapCameraControls` doesn't sync pan/zoom to the `useBattleMapView` store → detail/overview LOD frozen at initial camera state (fine for empty maps; wire up when terrain/tokens land).
- No `WebGLContextBoundary` in production `BattleMapView` (the dev-harness `BattleMapCanvas` has one).
- Battle Map route not lazy-loaded → Three.js/R3F (~1MB) is in the initial bundle for every route. `React.lazy` on `BattleMapPage` would fix it.
- `redeem_campaign_invitation`'s expiry/max_uses checks are dead code (no UI sets those columns yet).

**Next subsystem to build (pick one, write a plan with `writing-plans`, then execute with subagent-driven-development):**
- **Terrain/wall editor** — make `DimensionalTerrain` data-driven off a `battle_maps` terrain column instead of hardcoded fixture geometry (currently every map shows the same fixed walls). Most natural next step — directly extends what was just shipped.
- **Token placement/movement** — persist `Token` rows on a Battle Map, render/drag them (the renderer already supports tokens; needs data + persistence + the ownership-gated write model from issue #9).
- **Live Session state** (#9) — realtime sync via Supabase Postgres Changes + the Edge Function gateway; larger, depends on tokens existing first.
- Rules Content Editor (#7), Tactical Rules Automation (#6), AI generation (#8) — later, mostly independent.

Recommended order: terrain editor → token placement → live session. Each is one `writing-plans` + one subagent-driven-development run, same rhythm as the two subsystems already shipped.

---

## 2026-07-11 — Claude Code (Task 5: BattleMapView production viewer)

**Task**: Task 5 (final task) of `docs/superpowers/plans` battle map integration plan — replace the Task-4 stub `BattleMapView` with the real Canvas/MapControls/BattleMapScene composition that `BattleMapPage` mounts.
**Status**: done. Overwrote the stub with the exact brief code (Canvas orthographic camera + gl config matching `BattleMapCanvas.tsx`, `MapControls` with same target/zoom range, `<BattleMapScene />` with defaults — no tokens/terrain wiring, no stress-test or diagnostic scope creep). One deviation from the brief: exported `BattleMapCameraControls` (was unexported) purely for testability — see report for why. The brief's literal Step 1 test (`ReactThreeTestRenderer.create(<BattleMapView />)`) does not work: `@react-three/test-renderer` cannot host a real DOM-mounting `<Canvas>` from `@react-three/fiber` (confirmed by tracing the R3F reconciler source; no other test file in this repo renders `<Canvas>` through test-renderer for the same reason; a jsdom/RTL mount was also tried and never actually initializes the scene graph due to this suite's stub `ResizeObserver`). Substituted 3 tests that verify the same guarantees via real, unmocked renders of `BattleMapScene` and `BattleMapCameraControls` plus a plain element-tree check of `BattleMapView`'s own composition.
**Touched**: `app/src/battle-map/BattleMapView.tsx` (stub → real implementation), `app/src/battle-map/BattleMapView.test.tsx` (new). Full report at `.superpowers/sdd/task-5-report.md`. Committed on `feat/taleforge-battle-map-integration` (`bcbfea3`). `npm test` 136/136 (133 + 3), `npm run build` clean (zero TS errors — first clean build since Task 4's stub was introduced).
**Handoff**: this was the last task in the plan. Post-plan state: a DM can create a Battle Map and any campaign member can view a real, empty 2.5D scene end-to-end. Terrain/token placement, fog of war fed by real data, live Session state, and DM Prep staging remain out of scope, each its own future plan (issues #6–#9).

---

## 2026-07-11 — Claude Code (Task 1: battle_maps schema)

**Task**: Task 1 of `docs/superpowers/plans` battle map integration plan — `battle_maps` Postgres schema, RLS, and `create_battle_map` RPC (Wayfinder issue #4's Battle Map entity).
**Status**: done. Added `public.battle_maps` (campaign-scoped, no `session_id`), a select RLS policy gated by the existing `is_campaign_member` helper, and a `SECURITY DEFINER` `create_battle_map` RPC gated on `campaigns.dm_user_id = auth.uid()` — same gateway pattern as `create_campaign_invitation`. Also fixed a latent race in `vitest.integration.config.ts`: with two integration test files now present, vitest's default file-level parallelism raced concurrent `auth.admin.createUser` calls against the shared local GoTrue container, intermittently failing with `AuthRetryableFetchError`. Fixed with `fileParallelism: false` (only surfaces once 2+ integration test files exist, so invisible before this task).
**Touched**: `app/supabase/migrations/0003_battle_maps.sql` (new), `app/tests/integration/battle-maps.rpc.test.ts` (new), `app/vitest.integration.config.ts` (modified). Full report at `.superpowers/sdd/task-1-report.md`. Committed on `feat/taleforge-battle-map-integration` (`0b3a87d`). `npm test` 123/123, `npm run build` clean, `npm run test:db` 7/7 (stable across repeated runs).
**Handoff**: Task 2 (per the plan) consumes `create_battle_map(p_campaign_id uuid, p_name text)` from `api.ts` by exact name/params — that contract is in place. No other schema/RPC pieces from this task's brief were deferred.

---

## 2026-07-11 — Claude Code (final-review fixes)

**Task**: fixed 2 Important + 1 folded-in Minor finding from the final whole-branch review of `docs/superpowers/plans/2026-07-11-taleforge-foundation.md` (all 8 tasks complete), before merge.
**Status**: done. (1) `NewCampaignPage` now catches `createCampaign` failures, shows an error, and re-enables the submit button instead of dead-ending. (2) Added `app/supabase/migrations/0002_grants.sql` with explicit `GRANT`s for `authenticated` (matching each RLS policy) — this is exactly the follow-up flagged in the Task 5 entry below ("before 2026-10-30, replace the `auto_expose_new_tables` compat flag with explicit GRANT statements"). Also discovered and fixed a related gap: Supabase's revoke-by-default change also strips `service_role` privileges, which broke this repo's own integration-test cleanup under a hosted-realistic config — added one small `service_role` grant for that. Verified with `auto_expose_new_tables = false` + fresh `supabase db reset` that `test:db` passes 4/4 on grants alone, then set the flag to `false` permanently (redundant now, and scheduled for removal anyway). (3) `CampaignListPage`/`InvitePanel` now surface load/generate failures instead of failing silently.
**Touched**: `app/src/campaigns/{NewCampaignPage,CampaignListPage,InvitePanel}.tsx` + their `.test.tsx` files, `app/supabase/migrations/0002_grants.sql` (new), `app/supabase/config.toml`. Full report at `.superpowers/sdd/final-review-fix-report.md`. Committed on `feat/taleforge-foundation` (`310fffe`). `npm test` 123/123, `npm run build` clean, `npm run test:db` 4/4.
**Handoff**: all 3 review findings resolved, branch should be ready to merge pending human sign-off. No further follow-ups identified.

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

---

## 2026-07-11 — Claude Code (4)

**Task**: GitHub #4 "Model campaigns sessions and rules data" (Wayfinder ticket, child of map #1, `wayfinder:grilling`)
**Status**: done. Decisions: Character scoped to exactly one Campaign (no portability); Battle Map is a reusable Campaign-level resource, not per-Session (enables future AI map generation from campaign story); Rules Object / Homebrew Content scoped to one Campaign (no cross-campaign DM library). Authored full entity model on Postgres/Supabase: Campaign, CampaignMembership, CampaignInvitation, Character, BattleMap, Token, Session, SessionPlan, SessionLog, RulesObject, CampaignDraft. Resolved Session Save and DM View/Player View as derived (not separate stored entities) rather than asking.
**Touched**: issue #4 (resolution comment + closed), issue #1 map (Decisions-so-far, standing decisions, ticket checkbox, graduated fog, added an Out-of-scope line for character portability/DM library), `CONTEXT.md` (added `Rules Object` term). Committed on `main`.
**Handoff**: #6 "Design Tactical Rules Automation enforcement", #7 "Scope the Rules Content Editor", and #9 "Design realtime session state and autosave" are all now unblocked (only #8 remains blocked, needs #7 too). Pick any of #6/#7/#9 next.

---

## 2026-07-11 — Claude Code (5)

**Task**: GitHub #7 "Scope the Rules Content Editor" (Wayfinder ticket, child of map #1, `wayfinder:grilling`)
**Status**: done. Decisions: DMs can edit spell/ability/monster/item/encounter/trait/resource Rules Objects; `damage_type`/`condition` stay fixed system taxonomy for Tactical Rules Automation (#6) to reason about. Mechanically-relevant fields use the shared Procedural Ability Template schema (same one AI generation will use, #8) with validation; flavor fields are freeform. No object-versioning UI in V1 — Session Log snapshots relevant numeric fields at time of use instead, so edits never rewrite history.
**Touched**: issue #7 (resolution comment + closed), issue #1 map (Decisions-so-far, standing decisions, ticket checkbox, graduated fog, added an Out-of-scope line for version-history UI), `CONTEXT.md` (`Procedural Ability Template` reworded to cover both DM-authored and AI-generated abilities). Committed on `main`.
**Handoff**: #8 "Design AI-assisted campaign and ability generation" is now fully unblocked (was waiting on #4, #5, #7 — all closed). #6 "Design Tactical Rules Automation enforcement" and #9 "Design realtime session state and autosave" remain open/unblocked too. Three tickets left total.

---

## 2026-07-11 — Claude Code (6)

**Task**: GitHub #6 "Design Tactical Rules Automation enforcement" (Wayfinder ticket, child of map #1, `wayfinder:grilling`)
**Status**: done. Decisions: V1 automates grid movement/range, targeting, area effects, resistance/vulnerability, conditions, combat timing; line of sight and concentration deferred. Enforcement Preset (Strict/Balanced/Narrative) sets Hard/Warn/Advisory per rule category at campaign creation, DM overrides per category after. Hard = reject outright, no in-context override; Warn = DM-only confirm dialog, always logs `rule_warning` (+`override` if allowed); Advisory = passive hint, unlogged.
**Touched**: issue #6 (resolution comment + closed), issue #1 map (Decisions-so-far, standing decisions, ticket checkbox, graduated fog, new Out-of-scope line for LOS/concentration), `CONTEXT.md` (added `Enforcement Preset`). Committed on `main`.
**Handoff**: two tickets left — #8 "Design AI-assisted campaign and ability generation" (fully unblocked) and #9 "Design realtime session state and autosave" (fully unblocked). Either can go next; no more dependency ordering constraints between them.

---

## 2026-07-11 — Claude Code (7)

**Task**: GitHub #9 "Design realtime session state and autosave" (Wayfinder ticket, child of map #1, `wayfinder:grilling`)
**Status**: done. Most of the question was already answered by #2/#3/#4 (state ownership, event flow, save cadence, restore semantics). New decisions: Token writes are ownership-gated (owner/DM only via RLS) to prevent simultaneous-edit conflicts; a manual single-named Checkpoint (DM-triggered, not automatic/versioned) is the only point-in-time rollback in V1, distinct from normal always-current resume; dice rolls are hybrid (Edge Function rolls server-side as source of truth, client plays a cosmetic animation landing on that value).
**Touched**: issue #9 (resolution comment + closed), issue #1 map (Decisions-so-far, standing decisions, ticket checkbox, graduated fog), `CONTEXT.md` (added `Checkpoint`, explicitly distinguished from Session Save). Committed on `main`.
**Handoff**: one ticket left — **#8 "Design AI-assisted campaign and ability generation"**, fully unblocked. Once it closes, the entire Wayfinder map (issue #1) is done — "way to the destination is clear," ready to move from planning into an actual build plan.

---

## 2026-07-11 — Claude Code (8)

**Task**: GitHub #8 "Design AI-assisted campaign and ability generation" (Wayfinder ticket, child of map #1, `wayfinder:grilling`) — **last open ticket on the map**.
**Status**: done, and **the entire Wayfinder map (issue #1) is now complete** — all 9 child tickets closed. Decisions: DM reviews/imports Campaign Drafts per-item (not all-or-nothing); AI structured-output validation failures auto-retry with error feedback (capped attempts) before surfacing a plain-language error to the DM; AI-assisted Ability Generation is exposed standalone (e.g. from DM Prep), not only bundled into full campaign generation. Story Seed inputs and structured-output safety were inherited from CONTEXT.md/#7 — AI content shares the exact same schema/validation as DM-authored content.
**Touched**: issue #8 (resolution + closed), issue #1 map (marked `Status: complete` under Destination, final Decisions-so-far entry, all ticket checkboxes ticked, remaining fog trimmed to non-blocking items only), `CONTEXT.md` (`Generated Special Ability` reworded to drop a stale SRD reference). Committed on `main`. Map issue #1 left **open** (not closed) as the durable decision index — didn't close it unilaterally since wayfinder doesn't call for that and it's a reasonable thing to leave for the human to decide.
**Handoff**: no open Wayfinder tickets remain. Remaining non-blocking fog on the map: (1) concrete V1 starter-content naming/lore (world/demon lord/hero/class names — content design, not a boundary decision), (2) first implementation milestone order and test strategy, (3) whether to rename the `gcat332/dnd` repo/folder to match Taleforge branding (flagged repeatedly as high-blast-radius, needs explicit human sign-off, don't do unilaterally). Next natural step is likely `superpowers:writing-plans` or `to-tickets` to turn the now-resolved map into an actual implementation plan/tracer-bullet issues.

---

## 2026-07-11 — Claude Code (9)

**Task**: used `superpowers:writing-plans` to author the first implementation plan against the now-complete Wayfinder map.
**Status**: done. Wrote `docs/superpowers/plans/2026-07-11-taleforge-foundation.md` — an 8-task TDD plan covering: promote `prototypes/battle-map-renderer` → `app/` (the prototype answered its question, folding it into the real app per the prototype skill), Supabase client/env config, routing shell, Discord OAuth login, the campaigns/memberships/invitations Postgres schema + RLS + `SECURITY DEFINER` RPCs (`create_campaign`, `create_campaign_invitation`, `redeem_campaign_invitation`), and the create/invite/join Campaign UI flow end to end. Deliberately scoped to NOT touch Battle Map, live Session state, Rules Objects, or AI generation — those are separate future plans per subsystem (issues #6/#7/#8/#9), following the skill's scope-check guidance not to boil the ocean in one plan.
**Touched**: `docs/superpowers/plans/2026-07-11-taleforge-foundation.md` (new). Not yet committed — plans aren't code changes, left for the human/next session to decide when to commit. No other files touched (this task was pure planning, no code written yet).
**Handoff**: plan is written and self-reviewed (fixed a real Postgres `->`/`->>` operator-precedence bug found during review, and replaced a guessed Discord metadata field with an explicit verification+follow-up-migration step). Per the writing-plans skill, next is choosing an execution mode (subagent-driven vs inline) to actually build Task 1-8 — not yet started. If picking this up cold: read the plan file's Global Constraints section first, it explains the Edge-Function-vs-RPC distinction that matters for every later plan too.

---

## 2026-07-11 — Claude Code (superpowers:subagent-driven-development)

**Task**: Task 1 of `docs/superpowers/plans/2026-07-11-taleforge-foundation.md` — "Promote the prototype to the real app root"
**Status**: done. Moved `prototypes/battle-map-renderer/` → `app/` with `git mv` (preserving history); bumped package name `@dnd/battle-map-renderer-spike` → `@taleforge/app`; bumped Node engine `>=20.19.0` → `>=22.22.0` (for react-router 8.2.0 in Task 3). Verified: 96 tests passing, TypeScript build clean. From now on, all app code lives at `app/` root, not `prototypes/battle-map-renderer/`.
**Touched**: moved `prototypes/battle-map-renderer/**` → `app/**`, updated `app/package.json` (name + engines). Committed on `feat/taleforge-foundation`.
**Handoff**: Task 1 complete; app root is now set. Task 2 (Supabase client + env config) can begin whenever it picks up this branch.

---

## 2026-07-11 — Claude Code (Task 5 dispatch)

**Task**: Task 5 of `docs/superpowers/plans/2026-07-11-taleforge-foundation.md` — "Database schema: profiles, campaigns, memberships, invitations"
**Status**: done. Installed Supabase CLI 2.109.1, ran `supabase init`/`supabase start` against local Docker, wrote `app/supabase/migrations/0001_campaign_foundation.sql` (profiles + trigger, campaigns, campaign_memberships, campaign_invitations, RLS, and the three SECURITY DEFINER RPCs `create_campaign`/`create_campaign_invitation`/`redeem_campaign_invitation`). Added `test:db` script + `vitest.integration.config.ts` + `tests/integration/campaigns.rpc.test.ts` per the brief. `npm run test:db` 4/4 pass, `npm test` 106/106 pass (unchanged from Task 4 baseline).
**Deviations**: (1) set `api.auto_expose_new_tables = true` in `supabase/config.toml` — CLI 2.109.1's new default no longer auto-exposes new tables/functions to PostgREST roles without explicit GRANTs, which the brief's migration doesn't include; this deprecated compat flag (removed 2026-10-30) restores the behavior the migration assumes. (2) Found and fixed a real bug via self-review: the brief's `campaign_memberships` SELECT policy subqueried itself, causing Postgres `42P17` infinite-recursion. Added a `SECURITY DEFINER` helper `public.is_campaign_member()` (Supabase's documented fix for this exact RLS pattern) — access semantics unchanged, verified via an extra (uncommitted, throwaway) self-review test exercising stranger/member/DM visibility on all three tables.
**Touched**: `app/supabase/config.toml`, `app/supabase/.gitignore`, `app/supabase/migrations/0001_campaign_foundation.sql` (new), `app/tests/integration/campaigns.rpc.test.ts` (new), `app/vitest.integration.config.ts` (new), `app/vite.config.ts`, `app/package.json`, `app/package-lock.json`. Committed on `feat/taleforge-foundation` (`f9090f0`). Full report at `.superpowers/sdd/task-5-report.md`.
**Handoff**: Task 5 complete. Tasks 6/7/8 (campaign create/invite/join UI) can now call `create_campaign`, `create_campaign_invitation`, `redeem_campaign_invitation` by the exact names/param names given in the plan. Follow-up note for whoever picks this up: before 2026-10-30, replace the `auto_expose_new_tables` compat flag with explicit `GRANT` statements in a new migration. Also, Task 8's real Discord OAuth sign-in still needs to verify the `handle_new_user()` trigger's guessed metadata field names (flagged in the migration's own comment).
