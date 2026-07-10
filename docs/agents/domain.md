# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repo.

Read these when relevant:

- `CONTEXT.md` at the repo root for domain language.
- `docs/adr/` for architectural decisions once ADRs exist.

If an ADR directory or relevant ADR does not exist yet, proceed silently. The domain-modeling workflow creates docs lazily when terms or decisions are resolved.

## Use the glossary vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, test name, or plan, use the term as defined in `CONTEXT.md`. Avoid synonyms the glossary explicitly rejects.

If the needed concept is missing from the glossary, either reconsider the language or note it as a gap for domain modeling.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.
