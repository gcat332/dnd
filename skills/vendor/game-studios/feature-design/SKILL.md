---
name: feature-design
description: Use when authoring a structured design doc for one feature or rules system in the tabletop (movement, line-of-sight, concentration, initiative, a content editor) — walks through overview, behavior, formulas, edge cases, dependencies, tuning, and acceptance criteria section by section, precise enough to implement from.
---

# Feature Design

Guided, section-by-section authoring of a design document for a single feature or
rules system, precise enough that a programmer could implement it without guessing.
This is the heavyweight design path; for a small tuning change or minor tweak use the
`quick-design` skill instead. Output lives at `docs/design/features/<name>.md`.

This skill is **runtime-neutral**. Where it says "ask the user", present the options as
plain text and wait for a reply. This skill authors the doc itself — do not delegate
the content to other agents; you may consult the user, `CONTEXT.md`, and existing
designs, and that is enough.

> This structure fits the DnD rules engine especially well: the Formulas, Edge Cases,
> Tuning Knobs, and Acceptance Criteria sections are exactly what movement, range,
> line-of-sight, area effects, conditions, concentration, and resource rules need to be
> unambiguous.

## 1. Name the feature

A feature/system name is required. Normalize it to kebab-case for the filename
(e.g. "line of sight" → `line-of-sight`). If the target file already exists, this is
**retrofit mode**: read it, report which of the required sections are present vs.
placeholder, and author only the missing/incomplete ones — never overwrite existing
content.

## 2. Gather context first

Arrive informed. Before asking the user anything, read:

- `CONTEXT.md` — the domain glossary. Use its exact terms; flag any needed concept
  that is missing from the glossary as a gap.
- `README.md` — product direction, V1 scope, SRD-compatible + original-content rule.
- Existing feature designs under `docs/design/features/*.md` — read any this feature
  depends on (decisions it must respect) or that depend on it (expectations it must
  satisfy). Extract the interfaces, formulas, and edge cases that cross the boundary.
- `docs/adr/*` if present — architectural decisions that constrain this feature. If the
  design would contradict an ADR, surface the conflict rather than silently overriding.

Present a short **context summary** (feature, what it depends on / is depended on by,
existing decisions to respect, any relevant ADRs) and any locked cross-feature values
this design must not contradict. If an upstream dependency is undesigned, note that you
will define the expected contract and flag it provisional. Then ask: "Ready to start
designing `<feature>`, or want more context first?"

## 3. Create the file skeleton

Once confirmed, immediately create the file with empty section headers (incremental
writes need a target, and progress must survive interruption). Ask "May I create the
skeleton at `docs/design/features/<name>.md`?" first.

```markdown
# <Feature Name>

> Status: In Design · Last updated: <date>

## Overview
[To be designed]

## User Goal
[To be designed]

## Detailed Design
### Core Rules
[To be designed]
### States and Transitions
[To be designed]
### Interactions with Other Features
[To be designed]

## Formulas
[To be designed]

## Edge Cases
[To be designed]

## Dependencies
[To be designed]

## Tuning Knobs
[To be designed]

## UI Requirements
[To be designed]

## Acceptance Criteria
[To be designed]

## Open Questions
[To be designed]
```

## 4. Section-by-section design

Work each section in order with this cycle:

```
Context → Questions → Options → Decision → Draft → Approval → Write
```

State what the section needs; ask what you need to draft it; where a real design
choice exists present 2–4 options with pros/cons and a recommendation; draft for
review flagging provisional assumptions; ask the user to approve ("write it / make
changes / start over"); then write the approved content to file, matching on the
heading so the edit is unique. After each write, if the section named entities,
numeric constants, or formulas that appear in another feature design, compare values
and surface any conflict before moving on — never silently use a different number.

### Section guidance

**Overview** — one paragraph a newcomer could understand: what the feature is in one
sentence, how the user (DM or player) interacts with it (active / passive / automatic),
and why it exists — what the product loses without it. Stay at the behavior level; if
an implementation question arises ("event bus vs. polling?"), note it as "→ becomes an
ADR" and move on. Behavior belongs here; technical approach belongs in an ADR.

**User Goal** — what the DM or player is trying to achieve, and the experience target.
For pure infrastructure, state the effect users feel rather than a direct interaction.
Align with the product direction in `README.md`.

**Detailed Design** — the core of the doc:
- *Core Rules* — the fundamental mechanics. Numbered rules for sequential processes,
  bullets for properties. Precise enough to implement without questions. State
  constraints (what the user cannot do) as explicitly as capabilities. Keep it
  SRD-compatible where it touches published rules.
- *States and Transitions* — if the feature has states, map every state and every valid
  transition in a table.
- *Interactions with Other Features* — for each dependency, specify what data flows in,
  what flows out, and who owns the interface. Verify each against the other feature's
  design; flag mismatches.

**Formulas** — every calculation, fully defined. Begin each formula with this exact
structure; do not describe a formula in prose without its variable table:

```
The <formula_name> formula is defined as:

`<formula_name> = <expression>`

Variables:
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| <name>   | <sym>  | int/float | <min–max> | <meaning> |

Output range: <min> to <max> under normal play; <behavior at extremes>
Example: <worked example with real numbers>
```

Ask what the core calculations are, whether scaling is linear/stepped, and the expected
output ranges. A formula without defined variables cannot be implemented.

**Edge Cases** — explicitly handle unusual situations so they don't become bugs. Format
each as `If <condition>: <exact outcome>` with a rationale when non-obvious. Never write
"handle appropriately". Ask: what happens at zero, at max, at out-of-range values; what
happens when two rules apply simultaneously (define priority and tiebreak); what
degenerate strategy could a player exploit. Examples fit DnD naturally: "If a
concentration check is triggered while the caster is already unconscious…", "If two
effects reduce the same speed to below zero…".

**Dependencies** — map every connection with direction and whether it is hard (cannot
function without it) or soft (enhanced by it). This must be bidirectional: if this
feature depends on another, that other design should list this one as a dependent —
flag one-directional dependencies for correction.

**Tuning Knobs** — every designer/DM-adjustable value with a safe range and what breaks
if set too high or too low. This connects to the product's DM-configurable enforcement
(hard-block / warn-with-override / advisory). Point to the source of truth rather than
duplicating a knob owned by another feature.

**UI Requirements** — what screens or app chrome this feature contributes to. Keep it a
requirement list, not a UX design — if there is real UI, note that a UX spec should be
authored with the `ux-design` skill before implementation, and stories should cite
`docs/design/ux/<screen>.md`. If the feature has no UI, say so.

**Acceptance Criteria** — testable conditions that prove the feature works. Format each
as Given-When-Then: `GIVEN <initial state>, WHEN <action or trigger>, THEN <measurable
outcome>`. Include at least one criterion per core rule and one per formula, plus
criteria that verify cross-feature interactions. Every criterion must be independently
verifiable by a QA tester without reading this doc. Never write "the feature works as
designed".

**Open Questions** — anything raised but not resolved, each with an owner where known.

## 5. Post-design validation

Read the completed doc back from the file (the file is the source of truth, not
conversation memory) and verify: all required sections have real content; formulas
reference defined variables; edge cases have resolutions; dependencies list interfaces;
acceptance criteria are testable. Present a completion summary listing provisional
assumptions and any cross-feature conflicts found.

Then recommend validating the doc with the `design-review` skill — ideally in a fresh
session so the reviewer is independent of the authoring context.

## Principles

- Never auto-generate the whole doc as a fait accompli; author section by section with
  approval, writing each approved section immediately.
- Never contradict an existing approved design or ADR without flagging the conflict.
- Always show where a decision came from (dependency design, product direction, user
  choice, SRD).
- Keep domain terms aligned with `CONTEXT.md`.
