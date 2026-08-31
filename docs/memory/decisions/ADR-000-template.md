# ADR-000: Template

**Status:** Template (not a decision)
**Date:** YYYY-MM-DD
**Module:** NN — module name
**Supersedes:** —
**Superseded by:** —

> Copy this file to `ADR-NNN-short-slug.md`. ADR files are **append-only
> history**: once an ADR is merged, it is never edited to change its meaning.
> To change a decision, write a **new** ADR that supersedes it and update both
> files' `Supersedes` / `Superseded by` headers. `pnpm governance:check`
> fails the build if an existing ADR's body is modified rather than superseded.

## Context

What forced a decision. The constraint, the conflict, or the thing we learned
that made the status quo untenable. Include the versions/facts as of the date —
this is a historical record, not a living document.

## Decision

What we are doing, stated in the imperative and specific enough that someone
can tell whether code complies with it.

## Consequences

What this costs us, not just what it buys. List the things that get harder,
and for each one, the mitigation that makes it acceptable. An ADR with only
upsides is an advertisement, not a decision record.

## Alternatives considered

What else was on the table and why it lost. "We didn't think of it" is not an
alternative; "we rejected it because X" is.

## Compliance

How this decision is enforced — the lint rule, the test, the CI gate, or the
review checklist item. A decision nobody can verify is a preference.
