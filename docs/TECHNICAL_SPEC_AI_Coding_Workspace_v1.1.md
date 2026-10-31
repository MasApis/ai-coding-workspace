# TECHNICAL_SPEC — AI Coding Workspace
Version: 1.1 | 2026-10-31 | Status: Proposed for implementation (AI-001 revision)
References: PRD_AI_Coding_Workspace_v1.md, UI_UX_DESIGN_SPEC_AI_Coding_Workspace_v1.md

## 1. Scope and implementation principles
Original local-first implementation of project planning, AI chat, design specification and starter templates. Do not copy third-party private code, licensed premium material or branding. Single user on 127.0.0.1 by default; no authentication or billing in MVP. Offline functionality where local models are installed. AI agent asks permission before every file mutation, including creating or deleting files.

MVP exit gate: Project CRUD + configurable AI provider chat/generation + versioned markdown documents + review/approval + OpenCode handoff export + responsive UI + tests. Design Studio, template library, optional cloud AI and advanced agent execution occur after this gate.

## 2. Technology and packaging
- Workspace: pnpm workspaces (or npm workspaces if pnpm is unavailable; pick one and lock it).
- `apps/web`: React + TypeScript + Vite + Tailwind CSS; React Router, TanStack Query; markdown editor initially split textarea + preview, using a safe markdown renderer. Rich text optional later.
- `apps/api`: Node.js LTS, TypeScript, Fastify, Zod validation, `@fastify/cors`, `@fastify/rate-limit` if required.
- `packages/shared`: Zod schemas, API contracts, shared domain constants and types.
- Persistence: SQLite + Drizzle ORM with migrations. SQLite WAL mode, foreign keys on, migrations at setup.
- AI gateway: provider-agnostic, with saved provider configurations and model IDs. Ship OpenAI-compatible adapter and Ollama adapter first; include native Anthropic, Gemini, and OpenAI adapters as separate implementations. No default provider is required; user connects one in Settings.
- Tests: Vitest (unit/integration), Playwright (browser E2E). Native test fixture SQLite temporary DB.
- Local only binding: web 127.0.0.1:5173, API 127.0.0.1:3001. Frontend uses Vite proxy or explicitly allowed origin; do not expose API to LAN by default.
- Lightweight by default: one active local inference job per backend instance, modest max output, explicit cancellation; no image-generation dependency for MVP.

## 3. Architectural boundaries
Web UI -> API typed contracts -> services -> Drizzle storage / file-export service / AI gateway. UI cannot access local disk paths directly. Services: ProjectService, DocumentService, PlanningService, TaskService, ConversationService, ExportService, ProviderService. DesignService and TemplateService added P1. No shell execution in API for AI output. OpenCode handoff is files/ZIP only in MVP.

AI gateway adapter contract:
```
interface AIProvider {
  id: string;
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;
  streamChat(input: {
    model: string;
    messages: Array<{role:'system'|'user'|'assistant'; content:string}>;
    signal: AbortSignal;
    options?: {temperature?:number; maxOutputTokens?:number};
  }): AsyncIterable<{type:'delta'|'done'|'usage'; text?:string; usage?:unknown}>;
}
```
Network/provider failure must not leave a generated document with approved status.

## 4. Information architecture and routes
Global routes:
- `/` overview
- `/projects` all projects
- `/projects/new` create wizard
- `/projects/:projectId` project overview
- `/projects/:projectId/planning/:documentType` planner
- `/projects/:projectId/tasks` task list
- `/projects/:projectId/chat/:conversationId?` project chat
- `/projects/:projectId/exports` export/handoff
- `/projects/:projectId/design` P1 studio
- `/templates` P1 starter catalog
- `/settings` settings

Desktop: sidebar 240px expanded/64px collapsed; content max 1200px; planner left step rail, center editor, optional right AI panel. Tablet: right panel drawer; mobile under 768px: global nav drawer and one active planner pane. Light-first, accessible components. Use existing UI UX spec as source of truth for exact tokens.

Component hierarchy (illustrative):
```
App
  AppProviders (router, query client, notices)
  AppShell
    Sidebar / MobileNav
    Header / Breadcrumbs / AIConnectionIndicator
    RouteOutlet
      OverviewPage
      ProjectsPage / NewProjectWizard / ProjectOverviewPage
      PlanningPage
        PlanningSteps / MarkdownEditor / MarkdownPreview / ContextAIPanel
        DocumentStatus / VersionPicker / ApprovalDialog
      TasksPage / ExportPage
      ChatPage / ModelPicker / ContextSelector
      DesignStudioPage (P1) / TemplatesPage (P1) / SettingsPage
```

UI required states: loading, empty, partial/offline, error, success, unsaved changes, AI streaming/cancelled. Primary CTA singular per view. Avoid fabricated success indicators.

## 5. Data schema
All IDs random UUID or ULID; ISO timestamps UTC at API boundary. DB uses indexes on foreign keys and updated_at for list screens.

```
projects(id PK, name, slug, description, idea_md, stack_json,
         state [active|archived], created_at, updated_at)
documents(id PK, project_id FK, type, title, approval_state
          [draft|reviewed|approved], current_version_id nullable,
          upstream_manifest_json, created_at, updated_at)
document_versions(id PK, document_id FK, version_no integer,
                  content_md, origin [ai|user|import], created_at,
                  unique(document_id, version_no))
decisions(id PK, project_id FK, question, answer, rationale, created_at)
tasks(id PK, project_id FK, ticket_key, title, description_md,
      priority, state, dependency_keys_json, acceptance_json, created_at, updated_at)
conversations(id PK, project_id FK nullable, title, created_at, updated_at)
messages(id PK, conversation_id FK, role, content_md, provider_id,
         model_id, context_manifest_json, created_at)
exports(id PK, project_id FK, manifest_json, relative_file_path,
        created_at)
provider_settings(id PK, provider_type, base_url, model_name,
                  non_secret_config_json, enabled)
```
P1 migration: templates, design_versions. Avoid storing API tokens in provider_settings or project exports. Secret-store design must be done before cloud adapters ship. Keep `current_version_id` consistency using transactions and deferred assignment after initial document creation. Enforce project_id checks on every nested document/task/conversation query.

## 6. Document lifecycle and consistency
Seven baseline generated kinds: PROJECT_BRIEF, PRD, USER_FLOW, TECHNICAL_SPEC, TEST_PLAN, TASKS, AGENTS. Design spec is a separate P1 kind. Source of truth is DB version content; export renders deterministic filenames. Every save creates a new version (debounced draft writes may be batched); documents with approved version require explicit 'Create new draft from approved version' before changes. Approval explicitly binds exact version id and records time. When upstream approved content changes, downstream `upstream_manifest_json` becomes stale; show a non-destructive warning. Never delete historic versions during regeneration. AI output is always draft.

Generation strategy: section-by-section, predefined schema/question checklist, validation of response structure, safe markdown rendering; retries only when user requests. Structured requirements contain identifiers FR-* and task criteria refer to them. Prompt injection protection: untrusted project text remains user data; never interpreted as operational commands or permission to execute files.

## 7. REST endpoints
JSON success envelope `{data: ...}`; error envelope `{error:{code,message,details?}}`. Pagination `{items,nextCursor}` when needed. All mutation endpoints use Zod body validation. Prefer `If-Match` or version checks on document save to detect conflicting tabs.

```
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/documents
POST   /api/projects/:id/documents
GET    /api/documents/:id
POST   /api/documents/:id/versions
GET    /api/documents/:id/versions
POST   /api/documents/:id/review
POST   /api/documents/:id/approve
POST   /api/projects/:id/plan/questions
POST   /api/projects/:id/plan/generate/stream
GET    /api/projects/:id/tasks
PATCH  /api/tasks/:id
GET    /api/ai/models
GET    /api/ai/status
GET    /api/conversations?projectId=:id
POST   /api/conversations
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages/stream
POST   /api/projects/:id/exports
GET    /api/exports/:id/download
GET    /api/settings
PATCH  /api/settings/ai
```

P1 endpoints: `/api/projects/:id/design/*`, `/api/templates*`. The backend performs full authorization-by-ownership of local project IDs even for single-user version, to avoid cross-project context leakage.

## 8. Streaming protocol
Use SSE over HTTP response (POST response text/event-stream supported by fetch streaming). Events: `start` (request id, provider/model), `delta` (text chunk), `progress` (section name), `complete` (saved version id only after transaction), `error` (safe message and code), `cancelled`. Define a consistent event shape `{type,requestId,...payload}` and handle heartbeats. Cancellation via AbortController on browser and server; aborted generations do not auto-approve or overwrite documents. Persist output only after validated complete generation; optional draft partial capture must be visibly marked incomplete. Bound concurrent Ollama jobs to one and return friendly `AI_BUSY` status instead of queueing indefinitely.

## 9. Exports and file safety
Export approved-only by default; user may explicitly opt into drafts. ZIP contains deterministic filenames, `manifest.json` (project ID, doc types, version IDs, timestamp, sha256 checksums, no secrets) and README handoff instructions. Export ZIP built by backend to configured private export directory; endpoint downloads verified export ID, not arbitrary requested path. Extracted markdown never runs commands. Future folder handoff requires a dedicated allowlisted directory, canonical path checks, overwrite preview and explicit confirmation; no direct filesystem paths from model output.

## 10. Security and accessibility
- Bind to 127.0.0.1; reject untrusted Origins even on localhost. Avoid wildcard CORS.
- Use runtime configuration validation; sanitize logging, no credential dumps.
- Render markdown with safe URL policy, escape HTML and disallow arbitrary script. P1 HTML prototype preview must use sandboxed iframe, restrictive CSP, no access to app origin, no embedded external scripts by default.
- Validate names, metadata, files/ZIP sizes, and limit payload lengths.
- Never auto-run commands requested by AI; agent file mutations require explicit human approval.
- WCAG 2.2 AA target, keyboard focus, accessible dialogs, touch targets >= 44px, layout viewport 320/390/768/1024/1440px, reduced motion.
- Tests cover traversal, cross-project leakage, document state transitions, output errors, exports, and offline mode.

## 11. Test strategy
Unit: schema, version graph/staleness, markdown safe-render and export manifests. Integration: project CRUD, document version & approve, errors, AI adapter stub, ZIP manifest. E2E: create to-do project -> generate a draft (mock AI) -> edit/review/approve -> export -> reopen project. Run responsiveness/snapshot accessibility at representative widths. Actual Ollama smoke test is optional manual suite; CI does not require Ollama/internet.

## 12. Local development commands (target scripts, not yet implemented)
```
pnpm install
pnpm db:migrate
pnpm dev
pnpm test
pnpm test:e2e
pnpm lint
pnpm build
```
Configure `.env.example`: API_HOST=127.0.0.1, API_PORT=3001, OLLAMA_URL=http://127.0.0.1:11434, DB_PATH=./data/workspace.sqlite, EXPORT_DIR=./data/exports. No API keys in git. Do not state scripts work before they are implemented.

## 13. Phase gates
Gate A Foundation: static responsive dashboard and working DB migrations, test runner.
Gate B MVP: local generation, markdown versions and approvals, ZIP handoff, end-to-end user journey passes.
Gate C AI Chat: chat history/model picker and explicit project context.
Gate D Design Studio: documents and preview implemented safely.
Gate E Templates: original starter scaffolds work, overwrite handling verified.
Gate F Hardening: safety, backup, accessibility, cross-browser manual checks.

## 14. Deferred decisions
No code execution from browser; no login for solo localhost use; cloud AI secrets and architecture decided before P1 provider implementation; dark mode only after core accessibility review. If hardware cannot handle model and dev server simultaneously, allow model-less UI dev and mocked AI tests.


## 16. ADR AI-001 — Universal AI Gateway (supersedes Ollama-only rules above)
Status: Accepted for planning, 2026-10-31. **When older sections conflict, this section prevails.**

### User requirement
The app must support user-configurable AI providers, model ID and (where applicable) base URL/API key. Any supported provider may serve Planning and Chat. Ollama is optional, not required. “Any provider” means an adapter for its protocol exists; arbitrary HTTP endpoints cannot automatically be inferred. The initial provider roster is OpenAI-compatible (custom, including routers), Ollama, native OpenAI, native Anthropic, and native Google Gemini. Extend using a versioned adapter contract without changing domain services. Confirm current SDK/API names at implementation time rather than hardcoding presumed current models.

### Execution and interfaces
- Frontend -> authenticated local API -> Provider Registry -> capability-checked Provider Adapter -> upstream API. All credentials stay server-side.
- Proposed TypeScript abstraction:
```ts
type ProviderProtocol = 'openai-compatible'|'openai'|'anthropic'|'gemini'|'ollama';
type Capability = 'chat'|'streaming'|'models-list'|'tool-calling'|'structured-output';
type ProviderConfig = {id:string; label:string; protocol:ProviderProtocol; baseUrl?:string; credentialRef?:string; enabled:boolean};
type ModelSelection = {providerId:string; modelId:string};
interface ProviderAdapter {
  capabilities(): ReadonlySet<Capability>;
  testConnection(config:ProviderConfig, modelId?:string):Promise<{ok:boolean; message:string}>;
  listModels?(config:ProviderConfig):Promise<Array<{id:string; label?:string}>>;
  streamChat(config:ProviderConfig, request:{modelId:string; messages:Array<{role:'system'|'user'|'assistant';content:string}>; signal:AbortSignal; maxOutputTokens?:number}):AsyncIterable<{type:'delta'|'usage'|'done';text?:string;inputTokens?:number;outputTokens?:number}>;
}
```
- Anthropic and Gemini require native request/response adapters; not every API supports system-role messages, model listing, tools, or identical usage fields. Normalize only common capabilities; show unavailable features as disabled, not silently emulated.
- Routing: project-level default selection -> global default selection -> explicit “configure a provider” empty state. Allow model ID manual entry even when model-list endpoint is unavailable. A custom OpenAI-compatible provider may override its base URL.
- Provider configuration CRUD: label, protocol, base URL where allowed, model ID, credential input (write-only), enabled status; test connection, set default, safe delete (warn when referenced). Never send saved secrets back to frontend.
- Security: bind API to 127.0.0.1 by default; require deliberate credential setup and OS-protected secret storage or encrypted at-rest data with key outside DB; document threat assumptions. Do not treat base64 as encryption. Strict URL scheme validation (HTTPS for remote, explicit loopback HTTP exception), block link-local/private network access for remote custom endpoints, DNS resolution/rebinding checks, redirect denial or validation, connect/read timeouts, body limits and request limits. Do not log Authorization headers, API keys, prompts by default, or raw upstream errors with secrets. Custom HTTP endpoints on LAN require distinct explicit opt-in and security review.
- Test Connection is an explicit button, performs a bounded minimal request, never claims a model is functional merely from HTTP 200 without checking provider semantics. Return sanitized error categories (unauthorized, quota, invalid model, timeout, network, unsupported feature).
- Streaming via SSE, abort on disconnect, backpressure/bounds, no uncontrolled automatic retries for chargeable generations. Usage/cost display only if trustworthy provider data or configured rates exist, otherwise “not available.”
- Local AI may be slower; do not make laptop CPU/GPU support a prerequisite.

### Data model additions
- `provider_configs(id, label, protocol, base_url_nullable, credential_ref_nullable, enabled, created_at, updated_at)`; key itself NOT returned by API.
- `model_presets(id, provider_id, model_id, label, enabled)`; FK to provider.
- `ai_preferences(id, scope_type, scope_id_nullable, provider_id, model_id)` with global/project selection; validate FK and model belongs to provider.
- `ai_requests(id, project_id_nullable, provider_id, model_id, status, started_at, ended_at, error_code_nullable, tokens_in_nullable, tokens_out_nullable)` excluding prompt/secret by default.
- Migrations preserve older data; distinguish schema/API public fields from secret storage.

### Proposed API routes
- `GET /api/providers` (redacted configs), `POST /api/providers`, `PATCH /api/providers/:id`, `DELETE /api/providers/:id`
- `POST /api/providers/:id/test`, `GET /api/providers/:id/models` (optional capability; gracefully degrade)
- `GET/PUT /api/ai/preferences` and `GET/PUT /api/projects/:id/ai-preferences`
- `POST /api/ai/chat/stream` and `POST /api/projects/:id/planning/generate` requiring an explicit resolved model selection.
- Require Zod validation of payloads, standardized provider error response, network timeouts, and no secret fields in JSON response.

### Acceptance gates
1. User can connect a valid OpenAI-compatible provider with custom endpoint/model ID and complete a streamed prompt.
2. User can connect a separately supported native provider through its adapter.
3. User can optionally use Ollama, and a missing Ollama installation does not break startup or the rest of the app.
4. Provider tests cover success, wrong key, invalid model, unavailable models list, timeouts, cancellation, malformed stream, and sanitized error.
5. UI has edit/remove/set-default/test, secret masking and status feedback; mobile functionality works.
6. No API key is written into project exports, git-tracked config, frontend bundles, or logs.
