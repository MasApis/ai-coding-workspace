# IMPLEMENTATION_TICKETS — AI Coding Workspace
Version: 1.1 | Status: Ready for review (AI-001 revision)

## How to use
Select exactly one ticket in OpenCode Plan mode. Read PRD, design spec, technical spec and AGENTS.md; propose affected files and tests; request approval; then implement in Build mode. Review diff and run tests before committing. Never batch all tickets into one giant prompt.

## Dependency sequence
`001 → 002/003 → 004/006 → 005/007 → AI-024 → AI-025 → AI-026 → AI-027 → AI-028 → 009 → 010 → 011 → 012` (core, adapt to actual dependencies); later tickets 013–023 as needed.

## TICKET-001: Repository foundation
**Phase:** 1 — Foundation | **Depends on:** None | **Priority:** P0

**Scope:** Initialize workspaces, TS config, lint/format, env example and scripts.
**Acceptance criteria:** pnpm install and basic validation/build succeed; no secrets checked in.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-002: Database bootstrap
**Phase:** 1 — Foundation | **Depends on:** TICKET-001 | **Priority:** P0

**Scope:** Add Drizzle SQLite connection, migrations and tables for MVP.
**Acceptance criteria:** Migration up on clean SQLite; foreign keys enabled; repository tests pass.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-003: UI tokens and component primitives
**Phase:** 1 — Foundation | **Depends on:** TICKET-001 | **Priority:** P0

**Scope:** Implement palette, typography, buttons, form fields, dialogs, badges, skeletons.
**Acceptance criteria:** Keyboard focus and mobile targets supported; component demo verifies variants.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-004: App shell and responsive navigation
**Phase:** 1 — Foundation | **Depends on:** TICKET-003 | **Priority:** P0

**Scope:** Build routing, sidebar, mobile drawer, breadcrumbs, header, status indicator.
**Acceptance criteria:** Works at 320, 390, 768, 1024, 1440px; mobile nav keyboard accessible.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-005: Overview and projects UI
**Phase:** 1 — Foundation | **Depends on:** TICKET-002, TICKET-004 | **Priority:** P0

**Scope:** Build dashboard with real loading/empty/error states and project list.
**Acceptance criteria:** No fake counts; data from API; create-project CTA available.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-006: Project service and CRUD API
**Phase:** 2 — Core MVP | **Depends on:** TICKET-002 | **Priority:** P0

**Scope:** Implement project CRUD, validation, archiving, deletion safeguards.
**Acceptance criteria:** API persistence integration tests; invalid input rejected; archive filter works.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-007: New project wizard
**Phase:** 2 — Core MVP | **Depends on:** TICKET-004, TICKET-006 | **Priority:** P0

**Scope:** Build idea intake wizard, optional constraints, review and submit.
**Acceptance criteria:** Wizard creates project using API; required validations and mobile support.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-008: Legacy Ollama adapter (superseded by AI-027)
**Phase:** 2 — Core MVP | **Depends on:** TICKET-001 | **Priority:** P0

**Scope:** Models, status, streaming, cancellation, provider error mapping.
**Acceptance criteria:** Stub AI integration tests; disconnected Ollama friendly response; only one active generation.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-009: Document storage and versioning
**Phase:** 2 — Core MVP | **Depends on:** TICKET-002, TICKET-006 | **Priority:** P0

**Scope:** Document APIs, immutable versions, review/approve state and staleness.
**Acceptance criteria:** Edits create version; approved content cannot silently overwrite; transaction tests.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-010: Planner generation service
**Phase:** 2 — Core MVP | **Depends on:** TICKET-008, TICKET-009 | **Priority:** P0

**Scope:** Generate questions and sectioned PRD/Brief/User Flow/Technical/Test/Tasks/AGENTS as drafts.
**Acceptance criteria:** Structured output validation; no partial approved artifacts; source version manifest.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-011: Planning editor UI
**Phase:** 2 — Core MVP | **Depends on:** TICKET-004, TICKET-009, TICKET-010 | **Priority:** P0

**Scope:** Steps list, safe Markdown editor/preview, status, version selector, AI side panel.
**Acceptance criteria:** Approval works; unsaved edits safeguarded; mobile one-pane layout.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-012: Approved ZIP export and handoff
**Phase:** 2 — Core MVP | **Depends on:** TICKET-009, TICKET-011 | **Priority:** P0

**Scope:** Create manifest, deterministic .md filenames, download ZIP, instructions.
**Acceptance criteria:** Hashes included, no secrets, approved-only default, path traversal tests.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-013: AI conversations storage
**Phase:** 3 — AI Chat | **Depends on:** TICKET-002, TICKET-006 | **Priority:** P0

**Scope:** Conversation/message APIs and per-project linkage.
**Acceptance criteria:** History persists; unrelated project context excluded.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-014: AI chat screen and streaming
**Phase:** 3 — AI Chat | **Depends on:** TICKET-008, TICKET-013, TICKET-004 | **Priority:** P0

**Scope:** Chat UI, model selector, streaming stop/retry and history.
**Acceptance criteria:** Works offline with Ollama; cancellation and errors accessible.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-015: Explicit document context for chat
**Phase:** 3 — AI Chat | **Depends on:** TICKET-009, TICKET-014 | **Priority:** P0

**Scope:** Context picker and manifest of version IDs sent to AI.
**Acceptance criteria:** Nothing included by default; user sees each selected doc; cross-project checks.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-016: Design brief and sitemap engine
**Phase:** 4 — Design Studio | **Depends on:** TICKET-010 | **Priority:** P1

**Scope:** Generate original design brief, screen map, component list and tokens.
**Acceptance criteria:** Outputs trace back to approved requirements and are versioned.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-017: Design Studio UI
**Phase:** 4 — Design Studio | **Depends on:** TICKET-004, TICKET-016 | **Priority:** P1

**Scope:** Subnavigation for brief/sitemap/screens/tokens/preview; responsive canvases.
**Acceptance criteria:** Empty/error/loading; every screen linked to project; accessible controls.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-018: Sandboxed prototype preview
**Phase:** 4 — Design Studio | **Depends on:** TICKET-017 | **Priority:** P1

**Scope:** Render original local HTML/CSS demo inside isolated iframe.
**Acceptance criteria:** No script execution or app-origin access; downloadable prototype source.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-019: Starter template catalog
**Phase:** 5 — Templates | **Depends on:** TICKET-004 | **Priority:** P1

**Scope:** Build original static HTML and React starter metadata, filter UI.
**Acceptance criteria:** License and included files visible; cards respond at mobile widths.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-020: Template instantiate/export
**Phase:** 5 — Templates | **Depends on:** TICKET-019 | **Priority:** P1

**Scope:** Safe template ZIP and project creation from approved starter.
**Acceptance criteria:** No overwrite by default; path checks; README included.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-021: Local backup/restore
**Phase:** 6 — Hardening | **Depends on:** TICKET-012 | **Priority:** P1 hardening

**Scope:** Export and import project DB-derived data with schema versions.
**Acceptance criteria:** Roundtrip test, duplicate handling, invalid archive rejection.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-022: Security and resilience audit
**Phase:** 6 — Hardening | **Depends on:** TICKET-012, TICKET-015, TICKET-018, TICKET-020 | **Priority:** P1 hardening

**Scope:** Origin restrictions, XSS tests, file validation, error logging, offline failures.
**Acceptance criteria:** Security tests pass; no secrets in logs or ZIP.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## TICKET-023: Accessibility and release QA
**Phase:** 6 — Hardening | **Depends on:** TICKET-021, TICKET-022 | **Priority:** P1 hardening

**Scope:** E2E flow, keyboard, responsive, UX copy, migration/reinstall tests.
**Acceptance criteria:** MVP+P1 flows pass and release checklist signed off.
**Required evidence:** list changed files, test command/output, screenshot for UI changes, and any limitations.
**Excluded:** unrelated refactors, new dependencies without rationale, automatic writes without owner approval.

## Definition of Done (all tickets)
- Scope matches ticket and design tokens; tests and type checks pass.
- Error/empty/loading states present when appropriate.
- Responsive and accessible for UI tickets.
- API input validated; no credentials or external copyrighted content committed.
- OpenCode shows planned changes and receives user approval before modifications.
- Final implementation report lists exact files, test results and follow-ups.

## AI-001 revision ticket overlay — Priority P0
The following tickets supersede the old Ollama-only provider-first plan. Avoid implementing old TICKET-008 as a prerequisite. Old tickets 009+ must use provider selection and routing interfaces below.

### TICKET-AI-024 — Provider registry, schemas and secret boundary
**Depends on:** 001,002. **Scope:** provider registry, protocol enum, persistence, OS-protected secrets/encryption configuration, redacted CRUD API, model presets/preferences, feature flags. **Acceptance:** create/edit/delete provider, secrets never returned, DB migration + validation tests, safe unset default on deletion. No frontend work.

### TICKET-AI-025 — Universal gateway and OpenAI-compatible adapter
**Depends on:** AI-024. **Scope:** normalized messages/stream events, capability detection, cancellation, bounded streaming, timeout/error mapping, custom compatible URL policy. **Acceptance:** mock-compatible test server streams success; tests for bad key, missing model, cancel, malformed events, remote DNS/SSRF handling, no secrets in logs. No native adapters.

### TICKET-AI-026 — Provider Settings UI
**Depends on:** 003,004,AI-024,AI-025. **Scope:** add/edit/delete/test connection, manual model ID, models list if supported, set default, disabled states and mobile layout. **Acceptance:** E2E setup works, key masked on edit, provider-less empty state, failure messages understandable, keyboard accessible.

### TICKET-AI-027 — Native adapters and optional Ollama
**Depends on:** AI-025. **Scope:** OpenAI, Anthropic, Gemini and Ollama adapter modules, each using correct native semantics, normalized usage, explicit capabilities. **Acceptance:** contract tests with mocked provider responses, invalid model/missing auth handling, Ollama missing does not block app; live smoke tests optional when user provides credentials.

### TICKET-AI-028 — Default routing and feature integration
**Depends on:** AI-025,AI-026,AI-027,007. **Scope:** global/project provider choice; Planning and Chat use selected provider, streaming and cancellation; safe no-provider UI. **Acceptance:** switching provider changes only gateway route; PRD generation and chat both work with mock provider, no hidden Ollama hard-dependency, old approvals preserved.

### TICKET-AI-029 — Provider hardening (P1, after MVP)
**Scope:** opt-in fallback, capability-aware routing, request usage records, user-entered price schedules (if used), backup secrets exclusion, local LAN opt-in policy. **Acceptance:** no blind retries on paid requests; explicit failure/usage state; secret redaction verified.

### Mandatory per-ticket report
Proposed file list + approval request in Plan mode; implementation only after explicit consent; tests with real results; security caveats; screenshots for UI tickets.
