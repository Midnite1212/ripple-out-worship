# Commit, Branch, and PR Title Convention

This repo does **not** use Conventional Commits, even though `commitlint.config.js` extends `config-conventional`; its custom rule overrides the type checks. Tracking is GitHub Issues on `Harvest-Mission-Global/ripple-out-worship`, and every commit, branch, and PR is linked to an issue number.

## Commit subject

```
GH-<issue#>: <what the commit does>
```

- `GH-` prefix, the issue number, a colon, a space, then the description. The prefix links the commit to the issue in GitHub.
- **commitlint enforces it.** The `commit-msg` hook reads the leading number of the current branch name and rejects any subject that is not `GH-<that number>: …`. A branch without a leading issue number cannot commit through the hook.
- Description in imperative or plain past tense, either is in use. Match the surrounding commits on the branch.
- No type/scope prefixes (`feat:`, `fix(ui):`) and no trailing period.
- One subject line is the default. Add a body only when the _why_ is not obvious from the diff (a workaround, a data-shape quirk, a reverted decision). Keep it to a short paragraph.
- Review follow-ups keep the same issue number: `GH-187: address PR comments`.

Real examples from `git log`:

```
GH-192: add song mapping for ids
GH-187: refresh on create folder
GH-172: use the custom axios instead of the basic one
GH-168: drawer animation, show navbar when drawer open
GH-119: Fixed and enhanced logic for save setlist function
```

Avoid the shapes that slipped into history without the hook (`196 edit setlist bugs improvement`, `fix: make song code optional`, `fix misc`).

No issue yet? Open one first with `gh issue create -R Harvest-Mission-Global/ripple-out-worship` and use its number. `GH-1` appears in history as a fallback for cross-cutting fixes; prefer a real issue.

## Branch name

```
<issue#>-<type>-<short-description>
```

- `type` is `feature`, `hotfix`, or `release` per the README (`4-feature-chords-ui-improvement`). Many branches drop the type (`187-folder-fix`, `166-copilot-config`); both forms are accepted, but the issue number must come first or commitlint fails.
- Lowercase, hyphen-separated.

## Base branch and flow

- Flow is `feature` → `release` → `main`. Feature branches start from `release`, and their PRs target `release`.
- `main` is production. Only `hotfix` branches merge straight into `main`; `release` is merged into `main` at the end of a sprint.
- Dependent PRs are **stacked**: PR2 branches off PR1's branch and sets PR1 as its base, so each diff shows only its own changes. Merge in order.
- `git pull --rebase` to stay linear. Never merge `release` into a feature branch; rebase onto it.

## PR title

Same shape as the commit subject, describing the whole branch:

```
GH-147: Fix Setlist Page Bugs
GH-168: Fix Setlist Public View UI
```

Squash-merges reuse the PR title as the commit subject (GitHub appends ` (#<pr>)`), so it must carry the `GH-` prefix too.

## PR body

Start with `Closes #<issue#>` (or `Fixes #` / `Implements #`) so the issue auto-closes on merge. Then follow `.claude/docs/pr-description.md`.
