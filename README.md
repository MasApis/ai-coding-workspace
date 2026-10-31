# AI Coding Workspace — Handoff v1.1

This is a spec-driven planning package, not working application code.

## Canonical sources
1. `docs/PRD_AI_Coding_Workspace_v1.md` — product scope; **AI section is overridden by ADR AI-001 in Technical Spec v1.1**.
2. `docs/UI_UX_DESIGN_SPEC_AI_Coding_Workspace_v1.md` — design principles.
3. `docs/TECHNICAL_SPEC_AI_Coding_Workspace_v1.1.md` — authoritative technical source (including AI-001).
4. `tickets/IMPLEMENTATION_TICKETS_AI_Coding_Workspace_v1.1.md` — authoritative task plan.
5. `AGENTS.md` — approval and implementation rules.
6. `design/mockup.png` — conceptual design reference, not pixel-perfect specification.

## Getting started
Create an empty repo, unzip this package into it, start OpenCode Plan mode, and instruct it to read AGENTS.md and canonical documents. Start TICKET-001; seek explicit approval for file mutations. Review code and tests after each ticket.

AI-001 changes MVP from Ollama-only to universal provider configuration; adapters for native protocols are separate from OpenAI-compatible custom endpoints.
