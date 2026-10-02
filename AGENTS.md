# Instructions for the Ripple Out Worship agentic coding assistant

## Do this BEFORE you plan, propose, or act

### Mandatory Procedure

1. Match all tasks you're about to do against the _trigger table_. There can be multiple rules/files matched.
2. List ALL rule files you match, in bullet points.
3. Always open/read ALL matching docs.
4. Output a **Compliance** line quoting the exact rule, verbatim, from each doc.
5. Only then continue with your task.

### Trigger Table

If your work involves the task below, read the corresponding document/section first:

- write a commit message, branch name, or PR title/description → `.claude/docs/commit-convention.md` and `.claude/docs/pr-description.md`
- write or change any frontend code → the `react-frontend` skill (or subagent), `#frontend-code-standards`, `#working-in-a-messy-codebase`, and `#common-gotchas`
- add or change component styling or layout → `#mui-and-styling`
- fetch data or call the API from the UI → `#data-and-api`
- add or change a route, or gate a page on access → `#routing-and-access`
- read or write Redux state → `#state`
- parse, render, or transpose chord lyrics → `#chord-lyrics-format`
- write or change any backend code → `#backend-express`
- add or change an API endpoint → `#backend-express` (routes, `ROUTE_PERMISSIONS`, and the controller shape)
- touch login, JWT, the bearer header, or `/external-api` → `#auth-flow`
- handle user, ownership, group, or profile data → `#data-handling`
- review a branch or PR → the `/code-review` or `/deep-review` skill
- execute a plan or issue checklist → the `/gh-execute` skill

### Required Compliance-line format (the rule text comes from the doc, not from here)

> **Compliance (<doc-path-or-section>):** "<verbatim sentence copied from that doc>" → <what you will do>

---

> This file is the single source of instructions for **all** agentic coding assistants (Claude Code, Codex, OpenCode, Cursor, Copilot, and others). `CLAUDE.md` is a symlink to `AGENTS.md`; edit `AGENTS.md` only. Skills, docs, and the agent persona live under `.claude/` and are exposed to every tool: `.agents/skills` is a symlink to `.claude/skills` (Codex, Cursor, OpenCode read it), and `.opencode/agent/` and `.cursor/agents/` hold OpenCode's and Cursor's copies of the subagent. Keep `.claude/settings.local.json` out of git.

# ripple-out-worship

## Project Overview

The HMCC Hong Kong worship-team app: a song library with chord charts, key transposition, and setlists that can be grouped into folders, shared with teammates, and published as a public link. The README still calls it "Psalted 2", its earlier name.

Three independent packages in one repo, no workspaces wiring:

- `ui/` — React 18 **TypeScript** SPA on Create React App (`react-scripts` 5), MUI v5, Redux Toolkit + redux-persist, react-router-dom **v6**
- `server/` — Express 4 + Mongoose 7 in **TypeScript**, run with `ts-node` through nodemon
- Root `package.json` — ESLint, Prettier, Husky, lint-staged, and commitlint only

Login, sign-up, and password reset are **not** in this repo. They live on the main HMCC HK website (`hmcchk-web`), reached through the `/external-api` proxy. See `#auth-flow`.

Tracking is GitHub Issues on `Midnite1212/ripple-out-worship`, a self-hosted fork of `Harvest-Mission-Global/ripple-out-worship`; issue numbers below #2 in history refer to the upstream repo. Commits are `GH-<issue#>: …`, branches `<issue#>-<type>-<description>`, PRs merge `feature` → `release` → `main`. See `.claude/docs/commit-convention.md`.

## Important Instruction Reminder

- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal. Prefer editing an existing file.
- NEVER proactively create documentation files or READMEs unless asked.
- Unit tests cover pure logic only: chord parsing and transposition, lyrics helpers, song codes, `songKeys`, the store reset (`ui/src/**/*.test.ts(x)`, CRA Jest), and the server utils, middleware and controller input handling (`server/src/**/*.test.ts`, `node:test`). When you change logic they cover, keep them green and add a case; do not rewrite an expected value to make a test pass unless the behaviour change is intended and stated. UI components have no render tests; verify those with type-check, lint, build, and the browser.
- Reuse existing components and helpers before inventing new ones (see `#working-in-a-messy-codebase`).
- Use **yarn**, never npm or npx, for project work: `yarn` to install, `yarn <script>` to run, `yarn tsc` / `yarn eslint` / `yarn prettier` for binaries. The only `npx` in these docs is `npx gitnexus` (`#gitnexus-setup`), a per-machine tool that never touches `package.json` or `yarn.lock`.

## Working in a Messy Codebase

Most of `ui/src/components/` was written by junior volunteers over several sprints and it shows: 500–1100-line container files, close to 300 inline hex colours, hard-coded pixel sizes, separate `*Mobile.tsx` twins of desktop components, `any` used to silence the compiler, three different ways of fetching the same list, and copy-pasted controller helpers on the server. That is the starting point, not the standard.

- **Small edits match the file they are in.** Do not reformat, rename, or restructure code you were not asked to touch. A diff that mixes a fix with a cleanup is harder to review and to revert.
- **New code follows the standards in this file.** New files and components are where the bar is raised. Never copy a bad pattern into a new file because a neighbour has it.
- **Search before you build.** Read `ui/src/components/custom/` (shared dialogs, inputs, headers), `ui/src/helpers/`, and the sibling feature folder first. A component may already exist under a different name (`ConfirmationDialog`, `HelpDialog`, `AutocompleteInput`, `HeaderWithIcon`, `SongPreviewModal`).
- **Extract only on the second use.** A component moves to `components/custom/` when a second feature needs it, not to tidy one file.
- **Name your precedent.** When two existing implementations conflict, say which file you followed and why. If neither is fit, say so and propose the smaller change.
- **Cleanups are their own issue and PR.** If something is bad enough to fix, open an issue and do it separately.

## Development Commands

```bash
# Install (three separate installs, no workspaces)
yarn && (cd server && yarn) && (cd ui && yarn)

# Run locally (two terminals)
cd server && yarn dev           # Express on :1338 via nodemon + ts-node
cd ui && yarn start             # CRA on :3000; src/setupProxy.js proxies /api → :1338 and /external-api → REACT_APP_MAIN_URL/api

# UI (in ui/)
yarn typecheck                  # tsc --noEmit; 0 errors required
CI=true yarn test --watchAll=false   # Jest unit tests; all must pass
yarn build                      # production build → ui/build (CI moves it to server/client)

# Server (in server/)
yarn typecheck                  # tsc --noEmit; 0 errors required (noUnusedLocals and noUnusedParameters are on)
yarn test                       # node:test unit tests, no database needed (Node 21+ for the glob)
yarn build                      # tsc -p tsconfig.build.json → server/dist, tests excluded

# Lint and format (from repo root)
yarn lint                       # eslint over ui/ and server/; 0 errors required, do not add warnings
yarn prettier --write "<touched files>"
```

Prettier config: `.prettierrc.json` — 2-space, single quotes, semicolons, `printWidth: 100`, `trailingComma: 'es5'`. Husky runs lint-staged (Prettier + ESLint) on commit and commitlint on the message.

## Technology Stack

- **UI**: React 18, TypeScript (`strict`, `noImplicitAny`, `noImplicitReturns`), Create React App 5, MUI 5 (`@mui/material`, `@mui/icons-material`, `@mui/x-date-pickers` 6) on Emotion, Redux Toolkit 1 + redux-persist, react-router-dom 6, axios 1, react-hook-form 7 + zod 3 via `@hookform/resolvers`, dayjs, `@react-oauth/google`
- **Server**: Express 4, Mongoose 7, jsonwebtoken, cors, http-proxy-middleware 2
- **Fonts**: Work Sans and DM Sans through `@fontsource`

Majors only. `ui/package.json` and `server/package.json` are the source of truth for exact versions; check them before relying on an API. Use `dayjs` for dates.

## Architecture

### Frontend (`ui/src/`)

| Path                               | Role                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`                        | Entry: React 18 `createRoot` → `StrictMode` → `App`                                                                                                                       |
| `App.tsx`                          | Redux `Provider` → MUI `ThemeProvider` + `CssBaseline` → `GoogleOAuthProvider` → `BrowserRouter`; maps `routes.ts` into `<Route>`s, each wrapped in `PrivateRouteWrapper` |
| `routes.ts`                        | The single route table: `{ key, title, path, enabled, component, permissions }`                                                                                           |
| `components/<feature>/`            | Feature UI: `auth/`, `home/`, `song/`, `songsView/`, `setlist/`, `setlistView/`, `profile/`, `navigation/`. Route-level components end in `Container`                     |
| `components/setlist/hooks/`        | Setlist-only hooks (song search, folder members, tabs data, folder drawer)                                                                                                |
| `components/custom/`               | Shared building blocks plus `PrivateRouteWrapper.tsx`, `ErrorPage.tsx`, and `customAxios.ts`                                                                              |
| `components/utility/`              | Cross-feature modals (`SongPreviewModal`)                                                                                                                                 |
| `helpers/customHooks.ts`           | `useUser`, `useSongs`, `useOwnership`, `useOwnedSetlists`                                                                                                                 |
| `helpers/song/`, `helpers/global/` | Pure helpers (lyrics preview, first line, chord parsing, date format) behind `index.tsx` barrels                                                                          |
| `reducers/`                        | RTK slices: `user`, `songs`, `ownership`; barrel in `reducers/index.tsx`                                                                                                  |
| `store.ts`                         | `configureStore`; only `user` is persisted; `signout` resets every slice; exports `RootState` and `useAppSelector`                                                        |
| `types/`                           | Shared types: `song`, `setlist`, `ownership`, `user`, `form`                                                                                                              |
| `constants.ts`                     | Music keys, tempo, themes, `ChordColors`, layout heights and widths                                                                                                       |
| `theme.ts`                         | MUI theme: palette (incl. custom `darker` / `lighter` shades via module augmentation), typography, component overrides                                                    |
| `setupProxy.js`                    | Dev-only CRA proxy                                                                                                                                                        |

Imports are **relative** (`'../../helpers/customHooks'`). The `#/*` alias in `ui/tsconfig.json` is not supported by CRA's webpack; it only works today for type-only imports. Do not add new `#/` imports.

### Backend (`server/`)

| Path                                        | Role                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts`                                    | Express app: CORS, `/external-api` proxy to `MAIN_URL`, JSON body, `/api` router, static `client/` and SPA fallback outside development |
| `src/mongoose.ts`                           | `connectToDB()` from `MONGO_*` env vars                                                                                                 |
| `src/routes/index.ts`                       | Mounts `/ownerships`, `/groups`, `/setlists`, `/songs`                                                                                  |
| `src/routes/<resource>.routes.ts`           | `createPermissionRouter()` + one line per action, registered with the full path (`'/songs/create'`)                                     |
| `src/policies/`                             | `PermissionRouter`, `permissionMiddleware` (`requireAuth`, `requireAccessType`), and `permissions.config.ts` (`ROUTE_PERMISSIONS`)      |
| `src/controllers/<resource>.controllers.ts` | One exported `RequestHandler` per action                                                                                                |
| `src/models/<resource>.model.ts`            | Mongoose schemas: `Song`, `Setlist`, `Ownership`, `Group`                                                                               |
| `src/types/`                                | `<Resource>Schema` and `<Resource>Document` types per model                                                                             |
| `src/utils/`                                | `verify-jwt.ts`, `response.ts`, `pick.ts`, `validation.ts`; password-reset email lives on the main site                                 |

## Frontend Code Standards

### File organisation

- Feature components in `components/<feature>/`, PascalCase file names, one default-exported component per file.
- Shared components (2+ features) in `components/custom/`. Non-UI logic in `helpers/`. Types used by more than one file in `types/`.
- Do not create a new top-level folder under `ui/src/` without asking.
- `customAxios.ts` sits in `components/custom/` for historical reasons. Import it from there; do not add a second client.

### Imports

```tsx
// 1. React and external packages
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

// 2. Local modules (relative)
import { customAxios as axios } from '../custom/customAxios';
import { useOwnership } from '../../helpers/customHooks';
import { SongSchema } from '../../types/song.types';
```

Import MUI icons by path (`@mui/icons-material/Delete`), not from the package root, to keep dev builds fast.

### Component shape

```tsx
type SongDeleteDialogProps = {
  open: boolean;
  songId?: string;
  onClose: () => void;
};

const SongDeleteDialog = ({ open, songId, onClose }: SongDeleteDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {};

  return <Box>…</Box>;
};

export default SongDeleteDialog;
```

### Naming

- Components and types `PascalCase`; functions, props, and variables `camelCase`; true constants `UPPER_SNAKE_CASE` (older constants in `constants.ts` are camelCase; leave them).
- Booleans `is/has/should`; event props `on*`; handlers `handle*`.
- Props types are `<Component>Props`.

### TypeScript

- No new `any`. Type API responses with the types in `types/` (`axios.get<SongSchema[]>(…)`) and use `unknown` plus narrowing in `catch`. ESLint enforces `no-explicit-any` as an error.
- No non-null assertions (`!`) on fetched data or env vars in new code; guard instead.
- No `as` casts to paper over a wrong type. Fix the type.
- `ui/tsconfig.json` is strict. Keep `yarn tsc --noEmit` at 0 errors.

### Preferences

- Functional components with hooks; arrow functions; `const`/`let`; async/await.
- Ternary for either/or rendering, `&&` only for render-if-true with a boolean left side (`items.length > 0 &&`, never `items.length &&`), complex conditions extracted to a named `const`.
- Stable `key`s from data (`song._id`), not array indexes, for any list that can reorder, filter, or change.
- `useEffect` dependency arrays must be complete. `react-hooks/exhaustive-deps` is at 0 warnings and `yarn lint` runs with `--max-warnings=0`; fix the effect or move the function inside it.
- Reuse library code over hand-rolled logic: dayjs for dates, zod for validation, MUI components over custom HTML.
- Produce valid HTML. MUI `Typography` renders `<p>` by default; nesting it inside a `Button` or another `Typography` yields invalid DOM. Use the `component` prop.
- Default to no comments. If a line needs explaining, rename the symbol. A comment is for a _why_ the code cannot say.

### Forms

- Local state for one or two fields.
- **react-hook-form + zod** (`zodResolver`) for anything larger, following `components/auth/LoginContainer.tsx`. Shared validators in `components/auth/helpers/zod.validators.ts`.
- Do not keep a second copy of form values in `useState` alongside RHF. `SongEditorContainer.tsx` does this and is flagged for refactor; do not copy it.

## MUI and Styling

- MUI **v5** API only. No v4 (`makeStyles`, `withStyles`, `@material-ui/*`) and no v6/v7 names (`Grid2` props from v7, `slotProps` shapes that v5 does not accept).
- Use the `sx` prop for one-off styles and `styled()` with **object syntax** for a styled element reused within a file. No inline `style={{}}`.
- Use theme values, not raw ones: `color="primary.main"`, `bgcolor="secondary.main"`, `theme.palette.primary.darker`, spacing numbers (`p: 2`), `theme.breakpoints`. The palette in `theme.ts` already defines the purple/dark scheme used across the app.
- Need a colour the theme lacks? Add it to `theme.ts` as a palette token, then use the token. Do not add new inline hex values. Material 3 role tokens already exist beyond the MUI defaults: `surface.{container,containerHigh,containerHighest,containerActive}`, `outline.{main,variant}`, `onSurface.{variant,secondary,neutral}`, `onPrimary.main`, `onSecondaryContainer.main`, `switchTrack.checked`, `scrollbar.thumb`. Never change an existing palette value to fit one screen; MUI derives defaults from them. String paths (`"outline.main"`) resolve only in `sx` keys and system props; inside `styled()`, `border`/`background` shorthands, and `InputProps.style`, use `theme.palette.x.y`.
- Layout sizes shared across files (sidebar width, header heights) live in `constants.ts`. Use them instead of repeating `'80px'`.
- Responsive props over media queries: `width={{ xs: '100%', md: '50%' }}`. Use `useMediaQuery(theme.breakpoints.up('sm'))` for logic, not a hard-coded `'(min-width:600px)'`.
- Every page renders on desktop and mobile; the app is used on phones during worship. Check both before calling a layout done. Prefer one responsive component over a new `*Mobile.tsx` twin; when you must edit an existing twin, edit both.
- Don't hoist a style object used once. Hoist only when reused, toggled conditionally, or passed to a memoized component.

## Data and API

```tsx
import { customAxios as axios } from '../custom/customAxios';

const fetchSong = async () => {
  try {
    const { data } = await axios.get<SongSchema>('/api/songs/get', { params: { id } });
    setSong(data);
  } catch (err) {
    logRequestError('Error fetching song:', err);
    setErrorMessage('Could not load this song. Please try again.');
  }
};
```

- Always use `customAxios`. It is a module-level singleton (`export let customAxios`) that `useUser` rebuilds with `updateAxiosClient(token)` once the token is verified; it sets `Authorization: Bearer <token>`. Import it by name each time; do not cache the instance in a module-level variable, because the binding is replaced.
- API paths: `/api/<resource>/<action>` for this server, `/external-api/<path>` for the main HMCC HK site.
- Log request failures with `logRequestError(context, err)` from `helpers/global`. Never `console.log`/`console.error` a raw axios error: its `config.headers` carries the user's JWT.
- Every request handles failure visibly. Mutations show a Snackbar on success and on failure (see `SetlistFolderDetail.tsx` for the pattern). Never show a success message without checking the result. Never render the raw server error string.
- Lists and records from the API can be empty, missing fields, or `null` (`publicLink`, `date`, `code`, `simplifiedChordLyrics`). Guard with `?.` and `Array.isArray` before `.map`.
- `GET /api/setlists/get` without an id returns only setlists the caller can edit; load a folder's setlists by id (`params: { id: folder.setlistIds }`). Prefer fetching what a page needs with query params (`/api/setlists/get?id=…`) over pulling every record into Redux. Do not add a Redux cache for setlists or folders; fetch them where they are used.

## Routing and Access

- react-router-dom **v6**: `<Routes>`, `<Route element={…}>`, `useNavigate`, `useParams`, `<Navigate replace>`. No v5 APIs (`Switch`, `useHistory`, `props.history`, `component=` on `Route`).
- Every route is an entry in `ui/src/routes.ts`; `App.tsx` wraps each in `PrivateRouteWrapper`. Never add a bare `<Route>` in a component.
- Each entry needs a **unique `key`** and a path that does not shadow another. `/setlist/:id?` and `/setlist/details/:id?` overlap; check ordering and v6 ranking when adding setlist paths.
- `permissions` values handled by `PrivateRouteWrapper`: `'noUser'` (logged-out only, redirects home when logged in), `'user'` (any logged-in user, redirects to `/login`), `'admin'` (`user.accessType === 'admin'`), `'public'` (anyone; logged-in users see it without the nav bar). An unknown path falls through to the `*` route (`ErrorPage`). Read the wrapper before adding a new combination.
- Frontend gating is UX only. The real check is `ROUTE_PERMISSIONS` on the server. Say so when a task touches access, and change both sides together.

## State

- Redux holds: `user` (the JWT string, despite the slice name), `songs`, `ownership`. Only `user` is persisted to localStorage (redux-persist `whitelist`); `songs` and `ownership` are refetched on load. `signout()` resets every slice; pair it with `persistor.purge()` on logout.
- Use `useOwnership()` for the current user's ownership record and `useUser()` for the verified profile. `useUser()` calls `/external-api/auth/verify-token` on every mount, so call it once per page and pass `user` down, not in every child.
- `RootState` and `useAppSelector` come from `store.ts`. Use `useAppSelector` in new code.
- Do not add a slice unless the state is genuinely cross-page. Page state stays in the component.
- Never put new personal data into Redux; it ends up in localStorage.

## Chord Lyrics Format

Songs store `chordLyrics` (and optional `simplifiedChordLyrics`) as one plain-text string:

```
{Verse 1}
[G]Amazing [C]grace how [G]sweet the sound
{Chorus}
[C]My chains are [G]gone
```

- `{Section}` on its own line starts a block; `[Chord]` sits inline before the syllable it lands on.
- Parsing helpers live in `helpers/song/` and `helpers/global/common.tsx` (`findFirstLetterLyrics`, `isChordLyricsBlockEmpty`). Rendering and transposition live in `components/songsView/SongsLyrics.tsx` and `components/setlistView/SetlistViewSongDisplay.tsx`.
- Transposition indexes into `sharpMusicKeysOptions` / `flatMusicKeysOptions` in `constants.ts`; chord colours come from `ChordColors`. Reuse these; do not add a third key table.
- Lyrics are user-entered text. Render them as text nodes, never with `dangerouslySetInnerHTML`.

## Backend (Express)

### Adding an endpoint

1. Add the handler to `src/controllers/<resource>.controllers.ts` and export it.
2. Add one line to `src/routes/<resource>.routes.ts` with the full resource path: `router.get('/<resource>/action', handler)`. Routers are mounted without a prefix in `routes/index.ts`, so the path you register is both the URL under `/api` and the `ROUTE_PERMISSIONS` key. GitNexus `route_map` lists these routes but cannot link UI callers yet, because the UI calls them under `/api` through `customAxios`.
3. Add `'GET /<resource>/action'` to `ROUTE_PERMISSIONS` in `src/policies/permissions.config.ts`. A route with no entry logs a warning and falls back to `requireAuth`; never rely on that.

### Permissions

- `requiresAuth: true` adds `requireAuth` (valid JWT). `allowedAccessTypes` then adds `requireAccessType`. `PermissionConfig` is a union, so `allowedAccessTypes` cannot be set on a public route.
- `requiresAuth: false, optionalAuth: true` fills `req.user` when a valid token is sent and never rejects. Use it for endpoints that serve both the public setlist view and logged-in pages (`GET /setlists/get`), and branch on `req.user` in the controller.
- Access types on the server: `ministry`, `t3ch` (spelled with a 3; it is the stored value), `tc`, `admin`. The list is not hierarchical here: only the types listed are allowed.
- `requireAuth` only proves the caller is logged in. Setlist, folder, and ownership writes check ownership through `src/utils/authorization.ts` (`canEditSetlist`, `canDeleteSetlist`, `canEditGroup`, `canDeleteGroup`, `findCallerOwnership`, `sendForbidden`): load the target, then the caller's ownership, then 403 with `sendForbidden` before writing. New write endpoints must do the same.
- Rules: a setlist's creator, an admin, or a member of a folder listed in `setlist.groupIds` can edit it; only its creator or an admin can delete it. Folder members can edit a folder; only its creator or an admin can delete it (legacy folders without `createdBy`: any member). Folder membership changes go through `PUT /groups/members`; `PUT /ownerships/update` is self-only and accepts `setlistIds` only.

### Controller shape

```ts
const getSong: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.query;
  if (!isObjectIdString(id)) {
    sendResponse(res, 400, 'Invalid song id');
    return;
  }
  try {
    const song = await Song.findOne({ _id: id, isDeleted: false }).exec();
    if (!song) {
      sendResponse(res, 404, 'Song not found');
      return;
    }
    sendResponse(res, 200, song);
  } catch (error: unknown) {
    sendError(res, error);
  }
};
```

Shared helpers in `src/utils/`: `sendResponse` / `sendError` (`response.ts`; `sendError` maps Mongoose validation and cast errors to 400 and everything else to a logged, generic 500), `pick` (`pick.ts`), and `isObjectIdString` (`validation.ts`). Use them; do not add another per-controller `sendResponse`.

- Validate and narrow `req.query` / `req.body` values before using them in a query. Query values may be strings, arrays, or objects; ids must pass `isObjectIdString`.
- Never pass `req.body` straight into `create`, `findOneAndUpdate`, or `$set`. `pick` the allowed fields. Set `createdBy`, `userId`, and `accessType` from `req.user`, never from the body.
- Never use `upsert: true` on an update endpoint. An update for a missing id must 404, not create a document.
- Never send `error.message` to the client. Use `sendError`.
- Escape user input before using it in `$regex` (or use a text index). Raw input allows regex injection and slow queries.
- Soft delete is the convention: every model has `isDeleted`. Filter `isDeleted: false` in every read and update. Delete endpoints are `PUT /<resource>/delete` and set `isDeleted: true`.
- Models use `(models.X as Model<XSchema> | undefined) ?? model<XSchema>('X', schema)`. Keep the guard (nodemon reloads would otherwise throw `OverwriteModelError`) and the cast (a bare `models.X ||` widens every query to `any`).

### Server type-check

`server/tsconfig.json` has `noUnusedLocals` and `noUnusedParameters`. Prefix intentionally unused parameters with `_`. `yarn tsc --noEmit` in `server/` must show 0 errors.

## Auth Flow

- The main HMCC HK site (`MAIN_URL`) owns users, login, Google login, sign-up, and password reset. This repo has no user model.
- The UI calls `/external-api/auth/*`. In development `ui/src/setupProxy.js` rewrites that to `REACT_APP_MAIN_URL/api/*`; in production `server/app.ts` does the same with `MAIN_URL`.
- Login returns a JWT that the UI stores in the `user` slice. `useUser()` verifies it with `/external-api/auth/verify-token`, rebuilds `customAxios`, and loads or creates the user's `Ownership` record. On `token-expired` it clears localStorage and reloads.
- This server verifies the same JWT with the shared `JWT_KEY` and reads **`Authorization: Bearer <token>`** (standard spelling). The main site reads `Authorisation`; do not copy that spelling here, and do not "fix" either side to match the other.
- `req.user` (`AuthenticatedRequest`) holds the decoded `{ id, emailAddress, accessType }`. Trust it for identity; never trust a `userId` or `accessType` sent in the request body.

## Data Handling

User profiles from the main site carry personal data about real congregation members: name, email, phone, address, birthday, campus, life group, and membership status. `Ownership` stores names and access types; groups store who is on which team.

- Never paste personal data into commits, PR bodies, issue comments, screenshots, fixtures, or logs. Use dummy accounts for screenshots and blur anything real.
- Server log lines carry IDs, not names or emails.
- Endpoints return only the fields the UI needs. Do not add endpoints that list every ownership or user to unauthenticated callers.
- `REACT_APP_*` values are inlined into the public bundle; never put a secret there.
- No credentials in code. `.env` files come from GitHub secrets in CI and are never committed.
- Public setlist links (`/setlist/view/:id`) are visible to anyone; they must show song content only, not member data.

## Environment Variables

- `server/.env` (loaded by `dotenv` in `app.ts`): `PORT`, `MAIN_URL`, `BASE_URL`, `JWT_KEY`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_URI`, `MONGO_DB`, `MONGO_REPLICA_SET`, `MONGO_AUTH_SOURCE`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
- `ui/.env`: `REACT_APP_GOOGLE_CLIENT_ID`, `REACT_APP_MAIN_URL`. Required for `yarn start` and `yarn build`.
- `NODE_ENV=test` means "local development" in this repo: it disables static serving of `server/client/`. The `dev` script sets it through `cross-env`.

## CI / Deploy (`.github/workflows/`)

- `build-and-upload-workflow.yml` (manual, `uat` or `prod`): Node 20, frozen-lockfile installs of all three packages, secrets passed through `env:`, writes `.env` files from `UI_ENV` / `SERVER_ENV` secrets, runs `yarn build` in `ui/` with `CI=false` (warnings do not fail it), moves `ui/build/*` → `server/client/`, deletes `ui/`, zips, uploads, and triggers the deploy workflow.
- `deploy-and-delete-workflow.yml` validates `runId`, downloads the artifact on the server over SSH, and deletes it from GitHub. The artifact still contains `server/.env`.
- `pr-check.yml` runs on PRs to `release` and `main`: root lint, UI typecheck and tests, server typecheck and tests (Node 22). Keep all three green.
- `.github/copilot-instructions.md` is Copilot's short summary; this file is the source of truth when they differ.

## PR and Commit References

Read `.claude/docs/commit-convention.md` and `.claude/docs/pr-description.md` before writing any of these. Short version: `GH-<issue#>:` on every commit and PR title (commitlint enforces it against the branch's issue number), `Closes #<issue#>` as the first PR line, base PRs on `release`, stack dependent PRs.

## Common Gotchas

1. `user` in Redux is the JWT string, not a user object. Use `useUser()` for the profile.
2. The server reads `Authorization`; the main site reads `Authorisation`. Each side is correct for itself.
3. A route missing from `ROUTE_PERMISSIONS` silently falls back to `requireAuth`.
4. Public routes cannot take `allowedAccessTypes`; use `optionalAuth` when a public endpoint must know who is calling.
5. `requireAuth` is authentication, not authorisation. Check ownership on writes with the helpers in `utils/authorization.ts`.
6. `t3ch` is an access type, not a typo. The UI's `UserAccessType` enum knows only `admin` and `user`.
7. Every model has `isDeleted`; filter it on every read and update.
8. Server tests rely on `node --test` expanding `'src/**/*.test.ts'`, which needs Node 21+; on Node 20 pass the files explicitly.
9. The SPA is served from `server/client/` only after a CI build. Locally use the CRA dev server on :3000.
10. `#/` imports do not resolve in CRA at runtime. Use relative imports.
11. `useUser()` hits the network on every mount; do not call it in list items.
12. `isObjectIdString` requires a 24-character hex string; Mongoose's own `isValidObjectId` also accepts any 12-character string, so don't use it for request input.
13. The CI build sets `CI=false`, so warnings never fail a deploy. Treat them as errors locally. `ui/.eslintrc.js` is its own ESLint root (CRA + `@typescript-eslint/recommended` + single quotes and semicolons) because `ui/` and the root install different `@typescript-eslint` versions; edit it, not the root config, for UI rules.
14. Route `key`s in `routes.ts` must be unique, and React keys from data (`_id`), not indexes.

## Tooling

- `gh` CLI for issues and PRs: `gh issue view <n> -R Midnite1212/ripple-out-worship --comments`, `gh pr view --json baseRefName`, `gh pr create -R Midnite1212/ripple-out-worship --base release` (without `-R`, `gh` targets the upstream parent).
- Skills in `.claude/skills/` (also reachable as `.agents/skills/`): `react-frontend`, `code-review`, `deep-review`, `gh-execute`, plus the `gitnexus-*` set (regenerated by `gitnexus analyze`; do not hand-edit). Every tool that supports `SKILL.md` finds them there.
- GitNexus is expected in this repo (see `#gitnexus-setup` and the block at the end of this file). The committed parts are the skills and that block; the index itself is per-machine.
- Agent persona in `.claude/agents/react-frontend.md`. Claude Code dispatches it as a subagent, OpenCode via `.opencode/agent/react-frontend.md`, Cursor via `.cursor/agents/react-frontend.md`, and every other tool through the `react-frontend` skill, which points at the same file. Edit the `.claude/agents/` file only; the other three are pointers.
- Docs in `.claude/docs/`: `commit-convention.md`, `pr-description.md`.
- MUI docs: use the MUI MCP server (`useMuiDocs`, then `fetchDocs` with only the URLs it returns) when it is available, and pin answers to v5.

## GitNexus Setup

GitNexus gives the agent a call graph of this repo (impact analysis, execution flows, safe renames, taint analysis). The rules in the block below assume it is running. Two one-time steps per clone:

```bash
npx gitnexus analyze --pdg  # builds the local index into .gitnexus/ (gitignored) and writes .gitnexus/run.cjs; --pdg enables taint analysis
npx gitnexus setup          # registers the MCP server in your coding tool (Claude Code, Cursor, OpenCode, Codex, …); add -c <tool> to pick one
```

Re-run `analyze` after pulling large changes or when a tool reports the index is stale. On npm 11 an `npx` install crash (`node.target is null`) is a known issue; `npm i -g gitnexus` then `gitnexus analyze` works around it. Never commit `.gitnexus/`; it contains absolute paths and a machine-local database.

If GitNexus is not installed yet, say so at the start of the task and fall back to grep and file reads; do not pretend to have run `impact`.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ripple-out-worship** (5050 nodes, 9369 edges, 39 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "release"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource                                            | Use for                                  |
| --------------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/ripple-out-worship/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/ripple-out-worship/clusters`       | All functional areas                     |
| `gitnexus://repo/ripple-out-worship/processes`      | All execution flows                      |
| `gitnexus://repo/ripple-out-worship/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                               |
| -------------------------------------------- | -------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
