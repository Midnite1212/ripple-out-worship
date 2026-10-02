---
name: deep-review
description: When asked for "deep review" or "deep code review" of a branch or PR in ripple-out-worship.
---

This is a thorough code review that goes beyond surface-level changes to ensure the PR will not introduce bugs or break existing functionality.

## Step 1: Identify PR-specific changes

- Determine the PR base: `gh pr view --json baseRefName` if a PR is open, else `release` (or `main` for a `hotfix` branch).
- Isolate the branch's own commits: `git log --oneline origin/<base>..HEAD --grep="GH-<issue#>"`, or walk first-parent commits. Exclude merges from the base.
- List files changed by those commits only; ignore changes that arrived by merging the base.

## Step 2: Standard Review (same as /code-review)

- Run everything in `.claude/skills/code-review/SKILL.md`, including its "what to look for here" list.
- `git diff origin/<base>...HEAD` for the complete change set; review the final state of files, not individual commits.

## Step 3: Deep Analysis - Potential Bugs

For each changed file, check for:

### Import Consistency

- API calls go through `customAxios` from `components/custom/customAxios`; type-only `AxiosResponse` imports from `axios` are fine.
- Relative imports only; a `#/` import compiles under `tsc` but fails in the CRA bundle unless every binding is type-only.
- MUI icons imported by path (`@mui/icons-material/Delete`).
- No react-router v5 APIs (`useHistory`, `Switch`, `withRouter`). This repo is on v6.
- Everything used is imported; no circular import through the `reducers` or `helpers` barrels.

### Type and Runtime Safety

- `yarn tsc --noEmit` passes in `ui/` and `server/`. Check whether the PR passes it by adding `any`, `as`, or `!` rather than by fixing types.
- Every `.map`, `.filter`, `.length`, and nested property on fetched data is guarded, especially nullable fields (`publicLink`, `date`, `code`, `simplifiedChordLyrics`, populated `songs`).
- `useParams` values checked before use; `/setlist/:id?` makes `id` optional.
- Loading, empty, and error states rendered; async work in `try/catch` with user-visible feedback.
- Effects have correct dependency arrays and clean up timers, listeners, and in-flight requests; no state updates after unmount.
- Chord-lyrics parsing changes tested against a song with `{Section}` blocks, inline `[Chord]`s, a chords-only intro, and an empty `simplifiedChordLyrics`.

### Pattern Consistency

- Read the sibling feature folder, `components/custom/`, and `helpers/` to confirm the change follows the closest existing pattern; name the precedent file.
- If a change is applied to some call sites but not others (e.g. one of a desktop/`*Mobile.tsx` pair, or one of the three setlist-loading paths), grep for the rest and flag the gap.
- Do not flag pre-existing mess in untouched code; do flag new code that copies it.

### Routing and Access

- New routes are `routes.ts` entries with a unique `key` and valid `permissions` (`noUser`, `user`, `admin`, `public`).
- Paths do not collide under v6 ranking with `/setlist/:id?`, `/setlist/details/:id?`, `/setlist/folder/:id?`, `/setlist/add`, `/setlist/edit/:id`, `/setlist/view/:id`.
- Path changes do not break existing links, `navigate()` calls, or public setlist links already shared (`publicLink`).

### Backend changes (when the PR touches `server/`)

- New endpoint has both a route line and a `ROUTE_PERMISSIONS` entry with the right `requiresAuth` / `allowedAccessTypes`.
- Writes check ownership against `req.user.id`; no trust in `userId` / `accessType` from the body.
- No mass assignment: `create` / `findOneAndUpdate` / `$set` receive picked fields, not `req.body`.
- No `upsert: true` on update endpoints; missing ids return 404.
- Queries filter `isDeleted: false`; user input in `$regex` is escaped; query params are narrowed from `string | string[] | ParsedQs`.
- Error responses are generic; `error.message` stays in server logs.
- Email sending respects `NODE_ENV`; no member data in log lines.

### Breaking Changes

- Removed or renamed exports are not used elsewhere (grep the `helpers` and `reducers` barrels and every consumer).
- Response shape changes are matched in every UI caller.
- Redux slice shape changes: persisted state from older clients still loads (redux-persist rehydrates the old shape).

## Step 4: Cross-Reference Analysis

- For each changed file, identify the files that consume or are consumed by it (GitNexus `impact` / `context` when the index is fresh; grep otherwise).
- Run `detect_changes({scope: "compare", base_ref: "<base>"})` to confirm the affected execution flows match the PR's intent.
- For server changes, `explain({target: "<controller file>"})` to list taint findings from request input to Mongoose.
- Read the actual content of related files, not just diffs, to ensure compatibility.
- Check the change against both desktop and mobile render paths when a component has a `*Mobile.tsx` twin.

## Step 5: Output Format

### Issues Table

| Severity | File | Line | Issue | Suggested Fix |
| -------- | ---- | ---- | ----- | ------------- |

Severity levels:

- **Critical**: Must fix before merge - will cause runtime errors, data loss, or an access-control hole
- **High**: Should fix - potential bugs or breaking changes
- **Medium**: Recommended - inconsistencies or non-standard patterns
- **Low**: Nice to have - style or minor improvements

### Existing Code vs Suggested Fix

For each issue, show:

```tsx
// Existing code:
<actual code from file>

// Suggested fix:
<corrected code>
```

### Risk Assessment

Rate each area of change:

- Route matching and access gating
- Server permissions and ownership checks
- State management and persisted Redux state
- Data fetching and data-shape guards
- Chord parsing and transposition
- Mobile / desktop parity
- Error handling

### Final Score and Recommendation

- Score out of 10
- Clear recommendation: Approve / Request Changes / Block
- Summary of must-fix items

## Step 6: PR Title and Description

Same as /code-review:

- Title per `.claude/docs/commit-convention.md`: `GH-<issue#>: <what the branch does>`, issue number from the branch prefix.
- Description per `.claude/docs/pr-description.md`, opening with `Closes #<issue#>`; fill Changes and Verification from what was reviewed, leave Screenshots for the author.

## Important Notes

- Do not make code changes
- Read actual file contents, not just diffs
- Use grep/glob to find similar patterns across codebase
- Flag any inconsistencies between files changed in this PR
- Consider how changes interact with code NOT in this PR
