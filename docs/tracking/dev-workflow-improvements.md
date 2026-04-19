# Development Workflow Improvements

## Purpose

Track bounded improvements to contributor and agent workflow that are valuable
but not required for the current feature branch.

Use this file for process, automation, validation, screenshot, and PR-review
workflow tasks that are too concrete for `open-questions.md` but are not
behavior-preserving code refactors.

## Candidate Tasks

### Add a stable PR screenshot upload path

Status: open

Value:

- avoids agents discovering screenshot hosts during PR creation
- makes UX-facing PR descriptions consistently reviewable
- keeps generated screenshots out of `main` while still producing stable image
  URLs for GitHub Markdown
- reduces dependence on anonymous upload services that may be rate-limited,
  paused, temporary, or blocked

Recommended shape:

- add a repo-supported upload command, for example `npm run ui:review:upload`
- back the command with a small script under `scripts/ui-review/`
- upload selected files from `tmp/ui-review/<run>/` to one stable provider
- print Markdown image snippets or a PR-ready screenshot section
- document the supported provider and required local environment variables in
  `docs/dev.md`
- update `AGENTS.md` to say agents must use the supported upload path and should
  not try undocumented anonymous hosts during PR creation

Stable provider options to evaluate:

- Vercel Blob or Cloudflare R2 public bucket, preferred for a scriptable,
  agent-friendly workflow with durable URLs
- Supabase Storage public bucket, reasonable because the project already uses
  Supabase but potentially undesirable if review artifacts should stay separate
  from app backend resources
- GitHub Pages on a dedicated screenshots branch, stable and GitHub-native but
  stores generated artifacts in Git history and needs cleanup policy
- GitHub Actions artifacts plus PR comment, repo-native but less useful for
  inline PR-body image review and may expire

Open questions:

- Which storage provider should own PR-only review artifacts?
- What credential should local agents use, and where should contributors obtain
  it?
- Should screenshot URLs be permanent, time-limited, or cleaned up after PR
  merge?
- Should the upload script edit the PR body directly, print Markdown for manual
  review, or support both modes?
- Should CI also upload screenshots for specific UI test jobs, or should this
  remain a local PR-author workflow?

Steps to complete:

1. Choose the storage provider and retention policy.
2. Add a self-checking upload script under `scripts/ui-review/` that fails with
   clear setup guidance when credentials are missing.
3. Add an npm wrapper such as `ui:review:upload`.
4. Document setup, command usage, output format, retention, and failure handling
   in `docs/dev.md`.
5. Update `AGENTS.md` to require the supported upload path for UX-facing PR
   screenshots and to stop rather than improvising with random hosts when the
   path is unavailable.
6. Validate from a fresh local screenshot folder by uploading at least two PNGs
   and embedding the returned URLs in a test PR or draft PR.

Minimum validation:

- `npm run ui:review:capture`
- `npm run ui:review:upload -- tmp/ui-review/<run>`
- confirm the returned image URLs render in a GitHub PR description or comment

### Add an admin UI-review capture mode

Status: open

Value:

- avoids one-off Playwright scripts for each admin UX PR
- makes admin screenshots consistent across PRs
- captures the selected-event editor, validation, save success, and save error
  states without writing private draft rows
- gives agents and contributors a documented path for UX evidence when real
  Supabase admin access is unavailable or unsafe for write-path review

Recommended shape:

- extend `scripts/ui-review/capture-ui-review.cjs` with an admin-focused mode,
  or add a sibling script under `scripts/ui-review/` if the admin mocking setup
  would make the attendee capture script too broad
- support a command such as:
  `npm run ui:review:capture -- --mode admin`
- start from the local app running at `http://127.0.0.1:4173`
- use Playwright route mocks for Supabase admin session, allowlist, draft
  summary, draft-detail, and `save-draft` responses
- write screenshots to a timestamped directory under `tmp/ui-review/`
- capture at least mobile selected editor, desktop selected editor, local
  validation error, save success, and backend save error states
- include console-error and blank-page checks so failures are actionable

Open questions:

- Should admin capture live inside the existing capture script as `--mode admin`
  or in a dedicated script such as `capture-admin-ui-review.cjs`?
- Should the mocked draft fixture be inline in the script or imported from a
  shared test/admin fixture module?
- Should the default admin capture avoid all remote requests, or should it
  optionally support a real disposable Supabase admin environment?
- Should the script also capture the all-events workspace, create, and duplicate
  states from Phase 4.2?

Steps to complete:

1. Decide whether to extend the existing capture script or add a focused admin
   capture script.
2. Extract reusable Playwright helpers for opening routes, taking screenshots,
   and installing admin Supabase mocks.
3. Add stable mocked admin draft data that matches the canonical authoring draft
   shape.
4. Capture the required Phase 4.3 states across mobile-first and desktop
   viewports.
5. Add script logging that prints the output directory and the captured state
   names.
6. Document the admin capture command in `docs/dev.md` and reference it from the
   PR screenshot process.
7. Run the command from a clean dev-server start and verify the screenshots are
   nonblank and show the intended states.

Minimum validation:

- start the app with `npm run dev:web:local`
- run the admin capture command
- inspect generated screenshots under `tmp/ui-review/<run>`
- `npm run lint`
