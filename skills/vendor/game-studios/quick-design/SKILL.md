---
name: quick-design
description: Use for a lightweight design spec on a small change — a tuning adjustment, a minor behavioral tweak, or a small self-contained feature — when a full feature-design doc would be overkill but the change is too meaningful to implement without a written rationale.
---

# Quick Design

The lightweight design path. Use it for work under roughly a few hours of
implementation — tuning adjustments, minor tweaks, small additions to an existing
feature, or a standalone feature too small for a full design doc. For anything larger,
use the `feature-design` skill instead. This skill is **runtime-neutral**: where it
says "ask the user", present options as plain text and wait. Output lives at
`docs/design/quick-specs/<name>-<date>.md`.

## 1. Classify the change

Determine the category:

- **Tuning** — changing numbers/balance values in an existing feature, no behavioral
  change. E.g. "increase base movement from 30 to 35 ft", "reduce a spell's default
  save DC by 1".
- **Tweak** — a small behavioral change with no new states/branches. E.g. "let a dash
  cancel out of the move action", "allow an override on a warned rule".
- **Addition** — a small mechanic added to an existing feature, maybe 1–2 new states.
  E.g. "add a reaction window to opportunity attacks".
- **New Small Feature** — a standalone feature with no existing design doc, under
  roughly a week of work. E.g. "session-log export", "a dice-roll history panel".

If the change introduces a new feature with significant cross-feature dependencies,
exceeds ~a week, or fundamentally alters an existing feature's core rules — stop and
redirect to the `feature-design` skill.

State your inferred classification and why, and ask the user to confirm or correct it.
If they say it is too large, stop: **REDIRECTED** — use `feature-design`.

## 2. Context scan

Before drafting, read the relevant context:

- Search `docs/design/features/` for the design most relevant to this change; read the
  sections it would affect.
- Check `docs/design/quick-specs/` for prior quick specs touching the same feature —
  avoid contradicting them.
- `CONTEXT.md` for domain terms.
- For a Tuning change, also locate the data/config the value lives in, if any exists yet.

Report what you found (relevant design doc + section, any conflicting prior specs).

## 3. Draft the quick spec

Use the format matching the category.

### Tuning

```markdown
# Quick Design Spec: <Title>
Type: Tuning · Feature: <name> · Reference: docs/design/features/<file>.md · Date: <today>

## Change
| Parameter | Old | New | Rationale |
|-----------|-----|-----|-----------|
| <param>   | <old> | <new> | <why> |

## Knob Mapping
Maps to the Tuning Knob <name> (documented range <range>). New value is
<within / at the edge of / outside> that range. [If outside: why the range should change.]

## Acceptance Criteria
- [ ] <param> reads <new value> from <source>
- [ ] The difference is observable in <specific context>
- [ ] No regression in <related behavior>
```

### Tweak / Addition

```markdown
# Quick Design Spec: <Title>
Type: <Tweak / Addition> · Feature: <name> · Reference: docs/design/features/<file>.md · Date: <today>

## Change Summary
<1–2 sentences: what changes and why.>

## Motivation
<What problem or experience gap this solves.>

## Design Delta
Current design says (quoting docs/design/features/<file>.md, <section>):
> <exact quote>
This spec changes that to:
<new rule, written with the precision of a Detailed Design / Core Rules section — a
programmer should implement from this text alone.>

## New Rules / Values
<Full unambiguous statement of the replacement. List any new states; define any new
parameter ranges.>

## Affected Features
| Feature | Impact | Action Required |
|---------|--------|-----------------|
| <feature> | <how> | <update design / update data / none> |

## Acceptance Criteria
- [ ] <specific, testable>
- [ ] <specific, testable>
- [ ] No regression: <original behavior this must not break>

## Design Doc Update Required?
<Yes/No — if yes: which file, which section, what it should say.>
```

### New Small Feature

Trimmed structure — include only what is necessary; skip formulas/edge cases unless
required:

```markdown
# Quick Design Spec: <Title>
Type: New Small Feature · Date: <today> · Est. implementation: <hours>

## Overview
<One paragraph: what it does, when it activates, what it produces.>

## Core Rules
<Unambiguous rules — numbered for sequence, bullets for conditions. Precise enough to
implement without questions.>

## Tuning Knobs
| Knob | Default | Range | Rationale |
|------|---------|-------|-----------|

## Acceptance Criteria
- [ ] <functional: does the right thing>
- [ ] <functional: handles the edge case>
- [ ] <regression: does not break an adjacent feature>
```

## 4. Approval & filing

Present the draft in full and ask the user to approve, revise, or redirect to
`feature-design` if it grew too large. On approval, ask "May I write this to
`docs/design/quick-specs/<kebab-title>-<YYYY-MM-DD>.md`?" using today's date. Create the
directory if needed, then write.

If the spec flags a design-doc update, ask separately after writing the quick spec —
show the exact old-vs-new text before asking, and never edit the design doc without
explicit approval.

## 5. Handoff

Report the file written, the type, and whether a design-doc update is required. The
spec is ready to reference from an implementation ticket. Quick specs intentionally
bypass full `design-review`; redirect to `feature-design` if the change turns out to
add a tracked feature, significantly alters cross-feature behavior, or exceeds ~a week.
