---
name: design-review
description: Use before handing a feature/design document to implementation — reviews it for completeness, internal consistency, and implementability, and returns an APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED verdict with a rough scope signal.
---

# Design Review

Independently reviews a design document (typically one authored with the
`feature-design` skill) for completeness, internal consistency, and implementability.
This skill is **read-only** — it reports findings and never edits files. It is
**runtime-neutral**: where it says "ask the user", present options as plain text.

Review the document independently. If your runtime supports parallel sub-agents you
*may* spawn domain reviewers for a deeper adversarial pass (see Optional deeper pass),
but this is never required — a thorough single-agent review is the default.

## Phase 1: Load documents

Read the target document in full. Read `CONTEXT.md` for the domain glossary and
`README.md` for product direction and standards. Read related designs under
`docs/design/features/*` that the target references. For every dependency the doc
declares, check whether its design file exists — flag any that don't as broken
references downstream authors will hit. If a prior review log exists for this doc, read
the latest entry and track whether its blocking items were addressed.

## Phase 2: Completeness check

Check the document has real content (not placeholders) for each expected section:
Overview · User Goal · Detailed Design (core rules) · Formulas (all math defined with
variables) · Edge Cases (unusual situations resolved) · Dependencies · Tuning Knobs ·
Acceptance Criteria (testable). List any missing or placeholder-only sections.

## Phase 3: Consistency & implementability

**Internal consistency** — Do the formulas produce values consistent with the described
behavior? Do any edge cases contradict the core rules? Are dependencies bidirectional
(does the other feature's design know about this one)?

**Implementability** — Are the rules precise enough to implement without guessing? Are
there hand-wave sections where detail is missing? Are performance and persistence
implications considered (autosave, commit-to-campaign, realtime sync)?

**Cross-feature consistency** — Does this conflict with an existing feature or ADR? Does
it create unintended interactions? Is it consistent with the product direction and, for
rules content, SRD-compatible?

**Boundary testing** — For every formula, plug in minimum and maximum plausible inputs
and report any degenerate output (negative, divide-by-zero, infinity, nonsensical at
extremes). For every acceptance criterion, flag any that is not independently testable
("feels balanced", "works correctly" are not criteria) and suggest a concrete rewrite.

### Optional deeper pass (only if your runtime supports sub-agents)

You may spawn independent reviewers, each prompted adversarially — "your job is to find
problems, not validate" — for the domains the doc touches (rules/systems balance,
persistence/realtime, accessibility/UX, testability). Tag each finding with its source.
Surface disagreements rather than silently resolving them. Skip this entirely if
sub-agents are unavailable; do not simulate separate reviewers.

## Phase 4: Output the review

```markdown
## Design Review: <Document Title>
Re-review: <Yes — prior verdict X on YYYY-MM-DD / No — first review>

### Completeness: <X/8 sections present>
[missing sections]

### Dependency Graph
- ✓ <dep>.md — exists
- ✗ <dep>.md — NOT FOUND

### Required Before Implementation
[numbered — blocking issues only]

### Recommended Revisions
[numbered — important, not blocking]

### Nice-to-Have
[minor, low priority]

### Scope Signal
- S — single feature, no formulas, <3 dependencies
- M — moderate, 1–2 formulas, 3–6 dependencies
- L — multi-feature integration, 3+ formulas, may need a new ADR
- XL — cross-cutting, 5+ dependencies, multiple new ADRs likely
Label it, e.g. "Rough scope signal: M (verify before planning)".

### Verdict: APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED
```

## Phase 5: Close

The verdict is advisory — never block the user. Then:
- **APPROVED** — suggest proceeding to planning/implementation.
- **NEEDS REVISION / MAJOR REVISION NEEDED** — ask whether to revise now (work through
  the blocking items together, gathering any design decisions you cannot resolve from
  the docs), revise in a separate session, or accept as-is if all items are advisory.

Optionally offer to append a short entry to a review log next to the doc so future
re-reviews can track what changed:

```
## Review — <YYYY-MM-DD> — Verdict: <verdict>
Scope signal: <S/M/L/XL>
Blocking: <count> | Recommended: <count>
Summary: <2–3 sentences>
Prior verdict resolved: <Yes / No / First review>
```
