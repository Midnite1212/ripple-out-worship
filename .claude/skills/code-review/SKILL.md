---
name: code-review
description: When asked for "code review" of the current branch or a PR in ripple-out-worship.
---

- Treat the branch as a feature branch with an open PR. Compare it against its **PR base**: `release` by default, `main` only for a `hotfix` branch, or the parent branch for a stacked PR. Find the base with `gh pr view --json baseRefName` if a PR is open, else ask.
- Review the branch's own changes only and decide whether it is ready to merge into that base.
- Review as if you are the engineering lead who has to maintain this after the volunteers move on.
- Use `git diff origin/<base>...HEAD` for the complete set of changes; never rely on individual commit diffs.
- Always review against the final state of the files, and read the actual current file contents rather than trusting the diff hunk.
- Do not point out issues already resolved in the final state of the branch.
- Do not make code changes.

## What to look for here specifically

This codebase is uneven, so calibrate: the bar is "does this PR make its corner better or at least not worse", not "does this file now meet the style guide".

- Flag new code that copies a bad neighbouring pattern: inline hex colours or pixel sizes, a new `*Mobile.tsx` twin, `style={{}}`, `makeStyles`, a new `any` / `as` cast / non-null `!`, index keys on reorderable lists, a bare `axios` import instead of `customAxios`, a `#/` import. Do not flag pre-existing mess the PR did not touch.
- TypeScript: new `any`, unchecked `axios` responses (no generic), `catch (err: any)`, and casts that hide a wrong type.
- react-router v6 only: any `useHistory`, `Switch`, or `props.history` is a bug.
- New routes: an entry in `routes.ts` with a unique `key`, correct `permissions`, and no collision with existing setlist paths.
- Data fetching: errors surface to the user (Snackbar), success is not claimed without checking the result, raw server error text is not rendered, fetched arrays and nullable fields are guarded.
- Effects: complete dependency arrays, no new `exhaustive-deps` warnings, no `useUser()` inside list items.
- Backend changes in the same PR: a new endpoint has both a route line and a `ROUTE_PERMISSIONS` entry; writes check that `req.user` owns the target; `req.body` is not passed straight to Mongoose; no `upsert: true` on updates; queries filter `isDeleted: false`; `error.message` is not sent to the client; user input in `$regex` is escaped.
- Mobile and desktop both covered when layout changed.
- No member data in the diff, fixtures, or screenshots.
- Lint and type-check: `yarn lint` and `yarn tsc --noEmit` (ui and server) are clean on the branch.

## Output

- List issues with code examples to fix them; show the existing code alongside the suggested fix.
- Summarise with a score out of 10 and whether it should merge.
- Draft a copyable PR title and description:
  - Title per `.claude/docs/commit-convention.md`: `GH-<issue#>: <what the branch does>`. Take the issue number from the branch name prefix (`187-folder-fix` → `GH-187`), falling back to the commit prefixes.
  - Description per `.claude/docs/pr-description.md`, opening with `Closes #<issue#>`.
  - Fill the Changes table and Verification list from what you actually reviewed; leave the Screenshots table in place for the author to fill.
