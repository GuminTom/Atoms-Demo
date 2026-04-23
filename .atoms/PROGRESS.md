---
last_updated: 2026-04-22T12:52:54Z
---

# Requirements & Progress

## Requirements Overview

## User Stories

## Task Breakdown
| ID | Task | Assignee | Status | Deps |
|----|------|----------|--------|------|

## Progress Log
- 2026-04-22: Fixed password 72-byte bcrypt limit bug — backend schema now uses byte-level validator with truncation, frontend validates byte length instead of character length
- 2026-04-22: Registration and login system complete and working
- 2026-04-22: Statistics dashboard implemented — summary cards, weekly activity chart, agent mode usage, quick stats, recent deployments
- 2026-04-22: Profile page implemented — user info with edit, integrations, preferences, account/sign-out
- 2026-04-22: Lint and build pass, UI rendering verified
- 2026-04-22: Verified all password validation fixes — frontend byte-length check, backend schema truncation, auth service _prepare_password() all consistent; lint and build pass
- 2026-04-22: Fixed "Create & Start Coding" failure — root cause was web-sdk not forwarding Authorization headers, causing 401 on authenticated endpoints. Replaced api helper with native fetch that reliably attaches Bearer token; added error UI and loading state on Create App dialog. Lint and build pass.
- 2026-04-22: Added back arrow button to Workspace project page top bar — users can now click it to return to the home page. Lint and build pass.
- 2026-04-22: Added back arrow buttons to all sub-pages (Statistics, Profile, Settings, Deployments) — each navigates to home page. Lint and build pass.
- 2026-04-22: Removed "Project Type" functionality completely. Frontend: removed newAppType state, Project Type selector UI, and related payload from Workspace.tsx; removed type field, typeFilter, typeIcon map, type filter UI from Index.tsx (replaced type icons with generic 📦). Backend: removed type column from Apps model and type field from all three Pydantic schemas. Lint, build, and py_compile all pass.
- 2026-04-22: Fixed app save failure on Index page — root cause was same as Create App bug: `client.entities.apps` from web-sdk was not forwarding Authorization header, so fetchApps/update/delete/deploy all returned 401. Exported `buildEntityQueryUrl` helper into `lib/api.ts` and migrated Index.tsx to use native `api.get/put/post/delete` with Bearer token. All entity operations (list, edit, delete, status change, deploy) now authenticate properly. Lint and build pass.
- 2026-04-22: Fixed "signal is aborted without reason" error when new users tried vibe coding. Root cause: `client.ai.gentxt` from web-sdk had internal AbortController that aborted for local-auth users whose session wasn't synced with the SDK's expected Atoms platform session. Replaced with native fetch-based SSE streaming against `/api/v1/aihub/gentxt`, manually parsing SSE frames and forwarding the local Bearer token. Removed unused `client` import from Workspace.tsx. Lint and build pass.

