# Issue tracker: GitHub

Issues, Wayfinder maps, and Wayfinder tickets for this repo live in GitHub Issues for `gcat332/dnd`. Use the `gh` CLI for issue operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` / `gh issue edit <number> --remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside this clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

External PRs should not be pulled into the same triage queue as issues for now. This repo is still early-stage and uses GitHub Issues as the planning surface.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is a single issue with child issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Destination, Notes, Decisions-so-far, Not-yet-specified, and Out-of-scope sections.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue when available. Where sub-issues are unavailable, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body.
- **Ticket labels**: `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: prefer GitHub native issue dependencies. Where dependencies are unavailable, add a `Blocked by: #<n>, #<n>` line at the top of the child body.
- **Frontier query**: list the map's open children, drop tickets with open blockers or an assignee, and take the first remaining ticket in map order.
- **Claim**: `gh issue edit <n> --add-assignee @me`
- **Resolve**: comment with the answer, close the issue, and append a context pointer to the map's Decisions-so-far.
