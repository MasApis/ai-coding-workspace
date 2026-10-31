# AGENTS.md — AI Coding Workspace

## Mission
Implement original, provider-agnostic local-first AI Coding Workspace according to PRD, UI/UX Design Spec, Technical Spec and one approved implementation ticket at a time.

## Mandatory execution policy
1. Start in **Plan** mode. Read the current ticket and relevant source docs. Inspect existing code first.
2. Propose a concise file-level plan, risks, and test steps. **Ask for explicit user approval before creating, editing, moving, or deleting ANY file.** Do not equate a ticket request with blanket approval for all later changes.
3. After approval, switch to Build mode only for the approved files/scope. If scope changes, ask again.
4. Do not execute generated model text as shell instructions. Do not change files outside repository or approved export directory.
5. After implementation, run relevant tests and show a factual change summary and any failures. Ask before git commits as well.
6. Avoid unrelated cleanup, framework changes, or feature additions.

## Stack
React/TypeScript/Vite/Tailwind frontend; Fastify/Node/TypeScript backend; SQLite/Drizzle persistence; Zod contracts; universal AI gateway; supported cloud provider adapters + optional Ollama; SSE streaming. Prefer existing dependencies and scripts once initialized.

## UI source of truth
Use `docs/UI_UX_DESIGN_SPEC_AI_Coding_Workspace_v1.md` and approved mockup as visual direction. Minimalist, elegant, light-first, indigo accent, responsive down to 320px, keyboard accessible. Mockup is conceptual; fix inconsistencies rather than reproducing them blindly.

## MVP boundary
Deliver project CRUD, AI planning, document version/review/approval, user-configured provider generation, ZIP export, safe responsive frontend. Defer autonomous agent control, premium asset copying, billing, design-code generation and autonomous remote credentials handling.

## Coding requirements
- Small cohesive modules; validate server inputs; type all API interfaces.
- Persistence through DB migrations. No broad try/catch that hides errors.
- Show loading, empty, error, success and disconnected AI states.
- No unsafe HTML/Markdown rendering or unrestricted filesystem write.
- Protect approved document versions. Keep secrets outside git and exports.
- Include unit/integration/E2E tests appropriate to changes; mock AI in CI.

## Report after each ticket
Ticket ID, summary, created/changed files, commands/tests with pass/fail, UX checks, remaining risks, suggested next ticket. Never claim a test passed if it wasn't executed.


## AI-001 architecture override (mandatory)
- Read `TECHNICAL_SPEC_AI_Coding_Workspace_v1.1.md` and `IMPLEMENTATION_TICKETS_AI_Coding_Workspace_v1.1.md`; when v1.0 conflicts, v1.1 takes precedence.
- Do NOT assume Ollama is installed or make it a prerequisite. AI selection is provider-agnostic, explicit and user-configurable.
- Implement in order AI-024 → AI-025 → AI-026 → AI-027 → AI-028, observing ticket dependencies; never implement multiple unapproved tickets at once.
- Do not expose or log API keys. Never store credentials in git, client state beyond transient entry, ZIP exports, prompts, debug traces, or plaintext SQLite columns.
- Custom provider HTTP calls must prevent SSRF/DNS rebinding, reject unsafe redirects and bound duration/response size. HTTPS remote by default, explicit loopback exception.
- Do not invent model IDs or provider capabilities. Use user entry or valid provider model lists; offer manual ID entry when listing unavailable.
- Never claim a connection test succeeds until it actually validates an API request.
