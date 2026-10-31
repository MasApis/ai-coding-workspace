# PRD — AI Coding Workspace
Version: 1.0 | 31 October 2026 | Status: Draft for review

## 1. Executive summary
Local-first personal web application inspired by publicly documented categories of Ngoding Pake AI. Independently implemented; no copying proprietary code, premium content, branding, or assets. Four primary modules: Plan, Design, AI Chat, Templates. Integrates with Ollama and optional user-provided model APIs, exports Markdown/ZIP for OpenCode.

## 2. Research confidence
Publicly confirmed: Bikin Plan generates PRD, feature specifications, tasks; DesainPakeAI supports AI-assisted application design and prototyping; AndalAI supports multi-model chat and PRD; Templates provides starter codebase; site has Google sign-in and pricing. Not verified: private user flows, template contents, prompt chains, exact generated document schema, premium entitlements, source code, APIs. All detailed workflows below are proposed original implementation.
Public sources: https://www.ngodingpakeai.com/ ; https://www.ngodingpakeai.com/pricing ; https://www.ngodingpakeai.com/sign-in

## 3. Problem and goals
User wants a self-hosted workflow from idea to approved requirements, UI/UX design, technical plan and implementable coding tasks, avoiding repeated manual prompting and vendor lock-in.
Goals: generate/edit consistent spec documents; switch AI providers; save project versions; export portable files; prepare safe OpenCode handoff; work locally without cloud account.
Non-goals (v1): clone proprietary content, bypass payment, public marketplace, multi-tenant billing, fully autonomous agent with unrestricted file writes, real-time multi-user collaboration, exact parity with unknown paid features.

## 4. Persona and workflow
Primary user: solo developer familiar with OpenCode, Ollama and Laravel/web basics.
Flow: Create project -> describe idea -> AI asks bounded clarification questions -> produce Project Brief -> approve -> PRD -> approve -> user flows -> technical spec -> UI design brief/wireframe -> test plan -> tasks -> export -> user invokes OpenCode -> record test status.
Each generated artifact editable and independently re-generatable with immutable prior versions.

## 5. Functional requirements
### 5.1 Workspace (P0)
FR-001 Create, rename, archive and delete projects (deletion confirmed). FR-002 Store project type, stack, goal, constraints, language, status. FR-003 List and search projects. FR-004 Project overview with document completion states and last edited time.
Acceptance: CRUD persisted after restart; archived projects hidden by default; destructive action asks confirmation.

### 5.2 AI Planner / Bikin Plan equivalent (P0)
FR-010 Idea intake via free text. FR-011 AI clarifying questions with user option to skip. FR-012 Generate Project Brief, PRD, user flow, technical specification, test plan, task tickets, AGENTS.md. FR-013 Edit, save and preview Markdown. FR-014 Track draft/reviewed/approved statuses. FR-015 Regenerate individual sections while preserving approved versions. FR-016 Record assumptions and decisions. FR-017 Dependency links among generated artifacts. FR-018 Export individual files or ZIP of approved artifacts.
Acceptance: with a to-do-list example, generates all seven document categories; user can edit and approve; no approved text is overwritten without explicit confirmation; ZIP has deterministic filenames and manifest.

### 5.3 Design module (P1)
FR-020 AI-assisted design brief (audience, goals, style, constraints). FR-021 Generate sitemap, screen inventory, component inventory, design tokens and text wireframes. FR-022 Generate local HTML/CSS prototype from approved spec, sandboxed preview. FR-023 Accept user feedback and iterate versions. FR-024 Export design-spec.md and prototype source. FR-025 Reference imported user images only with permission.
Acceptance: prototype can be previewed, edited at spec level, and exported. No remote screenshot or exact UI cloning required.

### 5.4 AndalAI-like chat (P0/P1)
FR-030 Select installed Ollama models (P0), configured cloud model providers (P1). FR-031 Stream responses. FR-032 Save conversations per project. FR-033 Explicitly choose which project documents are attached as context. FR-034 Prompt templates for architecture, PRD review, debugging, task breakdown. FR-035 Show provider errors/retries and token estimates when available. FR-036 Abort running request. FR-037 Never expose API keys to the browser.
Acceptance: local chat works with Ollama; provider failures show a friendly error; saved history returns after restart; no context from unrelated projects is attached automatically.

### 5.5 Template library (P1)
FR-040 Browse/filter first-party starter templates by stack. FR-041 Preview folder structure, license, README and variables. FR-042 Instantiate template to a new workspace directory after path/overwrite validation. FR-043 Export scaffold ZIP. FR-044 Support original starter templates for HTML/CSS/JS, React, Laravel and Node API as they become ready.
Acceptance: user can generate an original static website starter with a README; no template overwrites existing files without confirmation.

### 5.6 OpenCode handoff (P0 basic, P2 advanced)
FR-050 Export an OpenCode-friendly package with PRD.md, TECHNICAL_SPEC.md, TASKS.md, TEST_PLAN.md, AGENTS.md. FR-051 Show handoff checklist and suggested commands. FR-052 Write files to a user-approved output folder (not arbitrary paths). FR-053 (P2) optional locally controlled task status import and per-task execution; never grant broad unattended write access by default.
Acceptance: selected files export correctly; user approves target directory; no implicit code execution.

### 5.7 Settings and safety (P0)
FR-060 Set local data directory, Ollama endpoint, model, generation limits. FR-061 Configure cloud API keys in backend-only secret storage (P1). FR-062 Restrict file paths to allowed workspace directories. FR-063 Back up and restore a project ZIP. FR-064 Log errors without storing secrets. FR-065 Provide user-visible clear-data action with confirmation.

## 6. Nonfunctional requirements
NFR-001 Run on Linux Mint and localhost without mandatory cloud account. NFR-002 Operate on 8 GB RAM by limiting requests/concurrency (AI performance depends on Ollama model). NFR-003 Document persistence via SQLite with migrations. NFR-004 Atomic document save and version recovery. NFR-005 Input validation and filesystem path traversal protection. NFR-006 Accessible keyboard-driven forms, labels and responsive layouts. NFR-007 Graceful errors/timeouts. NFR-008 Do not promise model output correctness; require review and tests. NFR-009 Offline use except explicitly selected cloud models.

## 7. Domain model
Projects(id, name, slug, description, stack_json, status, created_at, updated_at)
Documents(id, project_id, type, title, current_version_id, approval_state, created_at, updated_at)
DocumentVersions(id, document_id, version_no, content_md, origin, created_at)
Decisions(id, project_id, question, decision, rationale, created_at)
Tasks(id, project_id, title, description, priority, state, depends_on_json, acceptance_json, created_at)
Conversations(id, project_id, title, created_at)
Messages(id, conversation_id, role, content, model_id, context_manifest_json, created_at)
AIProviders(id, provider_type, base_url, model_name, config_json, enabled)
Templates(id, name, stack, license, source_path, variables_json)
Exports(id, project_id, manifest_json, output_path, created_at)
DesignVersions(id, project_id, version_no, spec_md, prototype_path, created_at)
Store secret material outside normal project export; do not persist credentials in config_json.

## 8. API outline
GET/POST /api/projects; GET/PATCH/DELETE /api/projects/:id
GET/POST /api/projects/:id/documents; GET /api/documents/:id; PATCH /api/documents/:id; POST /api/documents/:id/approve; GET /api/documents/:id/versions
POST /api/projects/:id/plan/generate (SSE); POST /api/projects/:id/plan/questions
POST /api/projects/:id/design/generate (SSE); GET /api/projects/:id/design/preview
GET/POST /api/projects/:id/conversations; GET /api/conversations/:id/messages; POST /api/conversations/:id/messages/stream (SSE)
GET /api/ai/models; GET/PATCH /api/settings/ai
GET /api/templates; POST /api/templates/:id/instantiate
POST /api/projects/:id/exports; GET /api/exports/:id/download
Validate all payloads; configure localhost CORS explicitly; provide request cancellation.

## 9. Architecture
React + Vite + Tailwind browser UI -> Fastify API (projects, documents, planning, design, chat, templates, export, settings) -> Drizzle ORM + SQLite; file storage for exports, markdown mirrors and prototypes; AI gateway -> Ollama local / optional cloud providers; OpenCode via explicit export/handoff (not automatically executing).
SSE streaming, provider adapter interface, structured JSON schema validation followed by Markdown rendering, deterministic templates for task/document skeletons. Single process modular monolith recommended.

## 10. Document workflow and dependency rules
Project Brief -> PRD -> User Flow + Technical Spec -> Design Spec + Test Plan -> Tasks -> Approved Handoff.
Each downstream generation captures upstream version IDs. If upstream changes, mark downstream as potentially stale and offer regeneration (never silently replace).

## 11. User interface information architecture
Sidebar: Dashboard, Projects, Planner, Design, AI Chat, Templates, Settings.
Project tabs: Overview, Documents, Design, Chat, Tasks, Export.
Key screens: project list, new project intake, wizard Q&A, Markdown document editor/preview/approval, design preview, AI conversation, template catalog, export modal, settings.

## 12. Security, privacy, IP
Local binding by default (127.0.0.1), no public internet listening without explicit configuration. Input and path validation. No shell execution from model output. Keep API tokens out of browser and exports. Escape/sandbox HTML preview. Respect template licenses; do not include paid third-party content or branding. Explicit consent before overwriting/modifying project files. Treat retrieved/attached text as untrusted input.

## 13. Success criteria
A user can create a project, produce all core planning documents, edit and approve them, export valid Markdown ZIP, and hand off to OpenCode without login or cloud API. Project survives restart. Local Ollama chat works if Ollama is installed and model available. Automated tests cover at least CRUD, document revisions, approval, ZIP export, path validation, and AI error handling.

## 14. Release plan
Phase 0: repository, design system, API skeleton, DB migrations, basic tests.
Phase 1 (MVP): projects, idea intake, Ollama adapter, planning documents, versioning/approval, exports, OpenCode handoff.
Phase 2: persistent chat, context selection, model switch, prompt presets.
Phase 3: design brief/sitemap/wireframes, HTML prototype, preview, export.
Phase 4: first-party templates, template instantiation.
Phase 5: optional cloud AI adapters, backup/restore, UX hardening, expanded E2E tests.

## 15. Risks and mitigations
Small local model yields unreliable long documents -> generate per section with schema validation and review. Limited RAM -> one generation at a time, short context, explicit limits. AI prompt injection -> treat documents as data and separate trusted instructions. File overwrite -> path allowlist, dry run/confirmation, backups. Scope creep -> phase gates and acceptance tests. Misrepresenting source product -> label all unverified features as original assumptions.

## 16. Open questions / assumed defaults
Single local user with no authentication (v1); Indonesian UI; Markdown canonical document format; default Ollama localhost:11434; optional cloud models not mandatory; OpenCode integration via ZIP/folder handoff rather than full agent control; templates are original or license-compliant. These are proposed defaults, not observed facts about reference site.
