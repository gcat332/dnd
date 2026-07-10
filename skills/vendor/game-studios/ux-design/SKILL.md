---
name: ux-design
description: Use when authoring a UX spec for a screen, flow, or persistent app chrome in the browser tabletop — walks through it section by section, arriving informed from existing context, and writes incrementally to a file.
---

# UX Design

Guided, section-by-section authoring of a UX spec for one screen or flow (e.g. the
battle map view, character sheet, DM view, player view, dice tray, session log), the
app's persistent chrome (nav/status bars, notifications), or the interaction-pattern
library. Output lives under `docs/design/ux/`.

This skill is **runtime-neutral**. Where it says "ask the user", present the options
as plain text and wait for a reply — do not assume a specific tool exists. Where it
says you *may* delegate, that is optional and only if your runtime supports parallel
sub-agents; the skill never requires it.

## 1. Determine what we are designing

Three modes:

| Target | Mode | Output file |
|--------|------|-------------|
| `app-chrome` | Persistent app chrome (nav, status, notifications) | `docs/design/ux/app-chrome.md` |
| `patterns` | Interaction pattern library | `docs/design/ux/interaction-patterns.md` |
| A screen or flow name (e.g. `character-sheet`) | UX spec | `docs/design/ux/<name>.md` |

If it is unclear, ask the user: "What are we designing — a specific screen/flow (name
it), the persistent app chrome, or the interaction-pattern library?" Normalize any
screen name to kebab-case for the filename.

## 2. Gather context first

Arrive informed. Before asking the user anything, read what exists:

- `CONTEXT.md` — domain language for this repo. Use its terms.
- `README.md` product direction and V1 scope (DM/player views, square-grid map,
  Discord login, autosave, etc.).
- Relevant feature designs under `docs/design/features/*.md` — read any whose UI
  needs touch this screen. These are the **requirements input** to this spec: collect
  them as constraints the spec must satisfy. If designing the app chrome, scan all of
  them, since the chrome aggregates cross-feature needs.
- Existing UX specs under `docs/design/ux/*.md` — note which screens are specced and,
  for screens that link to/from this one, read their entry/exit points so this spec
  matches.
- `docs/design/ux/interaction-patterns.md` (if present) — read only the pattern
  catalog index so you reference existing patterns rather than reinvent them.
- Any accessibility target the project has committed to (grep `docs/` for it). If none
  exists, assume **WCAG 2.1 AA** as a working baseline and note it as an open question.

Web-app delivery assumptions to confirm once (do not re-ask per section): primary
input is keyboard + mouse in a desktop browser; note whether touch/tablet is in scope;
note the DM-vs-player split, since hidden information visible only to the DM shapes
layout and state.

Then present a short **context summary** (screen, mode, feeding feature requirements,
related specced screens, known patterns, accessibility target) and ask: "Anything else
I should read before we start, or shall we proceed?"

## 3. Create the file skeleton

Once the user confirms, immediately create the output file with empty section headers
so incremental writes have a target and work survives interruption. Ask "May I create
the skeleton at `docs/design/ux/<name>.md`?" first.

If the target file already exists, this is **retrofit mode**: read it, report which
sections have real content vs. `[To be designed]` placeholders, and only author the
incomplete ones — never overwrite existing content. Fill placeholders in place.

### Skeleton — UX Spec (screen or flow)

```markdown
# UX Spec: <Screen/Flow Name>

> Status: In Design · Last updated: <date>

## Purpose & User Need
[To be designed]

## User Context on Arrival
[To be designed]

## Navigation Position
[To be designed]

## Entry & Exit Points
[To be designed]

## Layout Specification
### Information Hierarchy
[To be designed]
### Layout Zones (responsive)
[To be designed]
### Component Inventory
[To be designed]
### ASCII Wireframe
[To be designed]

## States & Variants
[To be designed]

## Interaction Map
[To be designed]

## Events / State Changes
[To be designed]

## Transitions & Animations
[To be designed]

## Data Requirements
[To be designed]

## Permissions (DM vs Player)
[To be designed]

## Accessibility
[To be designed]

## Acceptance Criteria
[To be designed]

## Open Questions
[To be designed]
```

### Skeleton — App Chrome

```markdown
# App Chrome Design

> Status: In Design · Last updated: <date>

## Chrome Philosophy
[To be designed]

## Information Architecture
### Full Inventory
[To be designed]
### Categorization (Always / Contextual / On-demand / Hidden)
[To be designed]

## Layout Zones
[To be designed]

## Chrome Elements
[To be designed]

## Dynamic Behaviors
[To be designed]

## Responsive & Permission Variants
[To be designed]

## Accessibility
[To be designed]

## Open Questions
[To be designed]
```

### Skeleton — Interaction Pattern Library

```markdown
# Interaction Pattern Library

> Status: In Design · Last updated: <date>

## Overview
[To be designed]

## Pattern Catalog
[To be designed]

## Patterns
[Individual pattern entries added here]

## Gaps & Patterns Needed
[To be designed]

## Open Questions
[To be designed]
```

## 4. Section-by-section authoring

Work each section in order using this cycle:

```
Context → Questions → Options → Decision → Draft → Approval → Write
```

1. **Context**: state what the section needs and surface relevant constraints from
   Phase 2.
2. **Questions**: ask what you need to draft it (one topic at a time).
3. **Options**: where a real design choice exists, present 2–4 approaches with
   pros/cons and your recommendation.
4. **Decision**: the user picks or gives custom direction.
5. **Draft**: write the section content for review; flag provisional assumptions.
6. **Approval**: ask "Does this capture <section> correctly — write it, small changes,
   or rethink?" Do not write until the user approves.
7. **Write**: replace the `[To be designed]` placeholder with the approved content
   (match on the heading + placeholder so the edit is unique).

### Section guidance — UX Spec mode

- **Purpose & User Need** — What is the user (DM or player) trying to *do* here? What
  breaks if this screen didn't exist? Complete: "The user arrives wanting to ___."
- **User Context on Arrival** — When in a session do they reach it, what were they just
  doing, what is their state (calm mid-planning vs. time-pressured mid-combat), and did
  they come here voluntarily or get routed here?
- **Navigation Position** — One-line orientation map: `root → parent → this screen`,
  plus alternate entry paths.
- **Entry & Exit Points** — Two tables: entry sources (trigger, context carried in) and
  exit destinations (trigger, any irreversible state change). Note one-way exits.
- **Layout Specification**:
  - *Information Hierarchy* — list everything this screen must communicate, then rank
    it (what must be seen first, what can be discovered). Approve before zones.
  - *Layout Zones* — propose 2–3 responsive zone arrangements (header, content, action
    bar, sidebar) with rationale; capture the choice. Note behavior at desktop vs.
    narrow widths.
  - *Component Inventory* — per zone, list components (type, content, interactive?,
    existing pattern referenced, or new pattern flagged).
  - *ASCII Wireframe* — offer one; draft in conversation, get feedback, then write.
- **States & Variants** — Beyond the happy path: default, empty (no data yet), loading
  (async fetch), error/failed action, and any permission/role state. Present as a table
  (State | Trigger | What changes).
- **Interaction Map** — Per interactive component: action (click, keypress, drag,
  hover), input(s) that trigger it (mouse, keyboard shortcut), immediate feedback, and
  outcome (navigation, state change, data write). Verify navigation targets against
  existing specs or note as a dependency.
- **Events / State Changes** — For each action, what client/server event or state
  change it fires (or explicitly "none"). Flag anything that writes persistent campaign
  or session state — that needs architecture attention (autosave, commit-to-campaign).
- **Transitions & Animations** — Enter/exit transitions, in-screen state-change
  animations, and a reduced-motion alternative for anything that could cause motion
  discomfort.
- **Data Requirements** — Table (Data | Source | Read/Write | Notes). Flag any case
  where the UI would own game/session state — that is an architecture concern, not a UX
  decision. Note real-time data (initiative timer, other players' token moves).
- **Permissions (DM vs Player)** — What is visible/editable for the DM vs. players.
  Hidden information (DM-only) must never leak into the player view; state it explicitly.
- **Accessibility** — Keyboard-only path through all interactive elements, focus order,
  text contrast and minimum sizes, no color-only information, screen-reader handling of
  non-text elements, reduced-motion. Meet the committed tier (or the WCAG 2.1 AA
  baseline).
- **Acceptance Criteria** — At least 5 specific, testable criteria a QA tester can
  verify without other docs. Cover at minimum: one load/responsiveness criterion, one
  navigation path, one empty/error state, one accessibility criterion, one specific to
  this screen's core purpose. Use checkboxes.

### Section guidance — App Chrome mode

Begin with **Chrome Philosophy** (1–2 sentences on the app's relationship with
persistent on-screen information — minimal and immersive, or information-dense for an
operational DM tool). Then complete **Information Architecture** (inventory every piece
of info the app must surface, categorize each as Always / Contextual / On-demand /
Hidden) *before* any layout. If the philosophy says "minimal" but the Always list grows
long, surface the conflict. Then **Layout Zones**, **Chrome Elements** (per element:
category, content, visual form, update behavior, contextual trigger), and reuse the UX
Spec guidance for Dynamic Behaviors, Responsive/Permission variants, and Accessibility.

### Section guidance — Interaction Pattern Library mode

Catalog patterns already used across existing UX specs (read their Component Inventory
and Interaction Map sections), ask the user for any not yet in specs, then formalize
each pattern:

```markdown
### <Pattern Name>
**Category**: Navigation / Input / Feedback / Data Display / Modal / Overlay
**Used In**: <screens>
**Description**: <what it is and when to use it>
**Specification**: behavior · input mapping · feedback · accessibility
**When to Use / When NOT to Use**
```

Finally, identify gaps — planned interactions with no pattern yet, and any inconsistent
patterns that should be consolidated.

## 5. Cross-reference check

Before marking the spec ready, verify and report:

- Every feature-design UI requirement that references this screen has a corresponding
  element here.
- All interaction patterns used are referenced by name; new ones are flagged for the
  pattern library.
- Entry/exit points match related specs (flag mismatches).
- Accessibility tier is addressed.
- Every data-dependent element has an empty state.

## 6. Handoff

State that the spec should be validated with the `ux-review` skill before
implementation. Then ask what is next: review this spec, design another screen, or
update the pattern library with new patterns from this spec. Note any related specs
that should cross-link (name them; don't edit them without asking).

## Principles

- Never auto-generate the whole spec as a fait accompli; author section by section
  with approval.
- Write each approved section to file immediately, so progress survives interruption.
- The user is the creative director on taste calls — present options, don't silently
  pick "the standard one".
- Never silently drop a feature requirement or silently expand the layout — surface
  conflicts and present resolution options.
- Always show where a decision came from (feature requirement, user choice, constraint).
