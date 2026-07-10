---
name: ux-review
description: Use when validating a UX spec, app-chrome design, or interaction-pattern library before implementation — checks completeness, accessibility, feature alignment, and readiness, and returns an APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED verdict.
---

# UX Review

Validates a UX design document before it enters implementation. This skill is
**read-only** — it reports findings and never edits files. It is **runtime-neutral**:
where it says "ask the user", present options as plain text and wait.

Run it after authoring a UX spec with the `ux-design` skill, after major revisions, or
before committing to build a screen.

**Verdict levels:**
- **APPROVED** — complete, consistent, implementation-ready.
- **NEEDS REVISION** — specific gaps; fix before build, not a redesign.
- **MAJOR REVISION NEEDED** — fundamental gaps in scope, user need, or completeness.

## Phase 1: Pick the target

- A specific file path (e.g. `docs/design/ux/character-sheet.md`) — validate that one.
- `all` — validate every file in `docs/design/ux/`; output a summary table
  (file | verdict | primary issue) first, then full detail for each.
- Otherwise ask the user which spec to validate.

## Phase 2: Load cross-reference context

Before validating, read:

1. The committed accessibility target (grep `docs/`), or fall back to WCAG 2.1 AA.
2. `docs/design/ux/interaction-patterns.md` if it exists.
3. The feature designs under `docs/design/features/*.md` referenced by the spec — read
   their UI requirements.
4. `CONTEXT.md` for domain terms, and `README.md` for the DM/player split and V1 scope.

## Phase 3A: UX spec checklist

**Completeness (required sections present):** Purpose & User Need · User Context on
Arrival · Navigation Position · Entry & Exit Points · Layout Specification (zones +
component inventory) · States & Variants (at least loading, empty, error) · Interaction
Map · Data Requirements · Events / State Changes · Transitions & Animations ·
Permissions (DM vs Player) · Accessibility · Acceptance Criteria (≥5 testable).

**Quality checks:**
- *User need clarity* — purpose written from the user's perspective, not the
  developer's; the goal on arrival is unambiguous; context is specific.
- *States* — error, empty, and (if async) loading states documented; any
  timed/auto-dismiss state has a duration.
- *Input coverage* — keyboard-only navigation fully specified; focus/Tab order defined;
  no interaction depends on hover-only or pixel-precise pointing without a keyboard
  equivalent; touch behavior specified if touch is in scope.
- *Data architecture* — no data element lists "UI" as owner (the UI must not own
  campaign/session state); update trigger specified for real-time data; null/loading
  handling specified for every data element.
- *Permissions* — DM-only (hidden) information is never exposed in the player view;
  this is stated explicitly.
- *Accessibility* — meets or exceeds the committed tier; no color-only indicators;
  focus order and contrast specified; reduced-motion alternative for animation.
- *Feature alignment* — every feature-design UI requirement referenced is addressed,
  and no UI element displays/modifies game state without a backing requirement.
- *Pattern consistency* — interactive components reference the pattern library or flag
  new patterns; no pattern is re-specified from scratch when it already exists.
- *Acceptance criteria quality* — specific enough for a QA tester who hasn't seen the
  design; includes a load/responsiveness criterion; none requires reading another doc.

## Phase 3B: App chrome checklist

Chrome Philosophy defined · Information Architecture covers every feature's UI needs ·
Layout Zones defined with responsive behavior · every chrome element fully specified
(zone, visibility trigger, data source, priority) · states by context cover at least
idle, in-combat, and modal/overlay · responsive adaptation covers desktop and narrow
widths · no element covers the primary content area without a rule to hide it · every
info item from any feature is either in the chrome or explicitly categorized as
hidden/on-demand · color-coded elements have non-color alternatives.

## Phase 3C: Pattern library checklist

Catalog index matches the actual patterns · all standard web controls specified
(button variants, toggle, slider, dropdown, list, grid, modal, dialog, toast, tooltip,
progress, input field, tabs, scroll) · every app-specific pattern needed by current
specs is present · each pattern has When to Use / When NOT to Use, full state spec, and
accessibility spec · no conflicting behaviors between patterns (e.g. "Back"/dismiss
behaves consistently).

## Phase 4: Output the verdict

```markdown
## UX Review: <Document Name>
Date: <date> · Document: <path> · Accessibility tier: <tier>

### Completeness: <X/Y sections present>
- [x] <section>
- [ ] <section> — MISSING: <what>

### Quality Issues: <N found>
1. <title> [BLOCKING / ADVISORY]
   - What's wrong: <specific>
   - Where: <section>
   - Fix: <specific action>

### Feature Alignment: <ALIGNED / GAPS>
- <feature> UI requirements — <X/Y covered>; missing: <list>

### Accessibility: <COMPLIANT / GAPS / NON-COMPLIANT>
### Pattern Library: <CONSISTENT / INCONSISTENCIES>

### Verdict: APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED
Blocking: <N> — must resolve before implementation
Advisory: <N> — recommended, not blocking
```

## Phase 5: Close

The verdict is advisory — never block the user from proceeding; document the risk and
let them decide. After the verdict:
- **APPROVED** — suggest proceeding to implementation.
- **NEEDS REVISION** — offer to help draft specific missing pieces, but do not auto-fix;
  wait for the user to ask. Re-run this skill after fixes.
- **MAJOR REVISION NEEDED** — suggest returning to the `ux-design` skill for the
  sections that need rework.
