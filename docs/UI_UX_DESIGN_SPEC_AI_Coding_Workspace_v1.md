# UI/UX Design Specification — AI Coding Workspace

Version: 1.0 | Date: 2026-10-31 | Status: Proposed — awaiting owner approval

## 1. Design direction
A personal, local-first AI project planning workspace. Character: simple, minimalist, elegant, responsive, practical. Prioritize clarity and focus over visual effects. Original identity; do not copy third-party branding, paid assets, or proprietary screens.

### Design principles
1. One clear primary action per screen.
2. Content-first: documents, tasks, and decisions are more important than decoration.
3. Progressive disclosure: advanced configurations remain tucked away until needed.
4. Predictable navigation across every module.
5. Safe by default: generation never automatically overwrites approved documents or project files.
6. Mobile usable, desktop productive.
7. Accessible by keyboard, clear labels, visible focus, sufficient contrast.

## 2. Product navigation / information architecture
Desktop left sidebar (collapsible):
- Overview
- Projects
- AI Planning
- Design Studio
- AI Chat
- Templates
Bottom: Settings, help, local AI connection status.

Project-specific header and tabs: Overview, Documents, Design, Tasks, Chat, Exports.

Mobile: top app bar (project name + menu) and drawer for global navigation; project tabs become horizontally scrollable segmented tabs. Never rely on hover for essential actions.

## 3. Visual design system
### Palette (light-first)
- App canvas: #F8FAFC
- Surface: #FFFFFF
- Primary text: #0F172A
- Secondary text: #64748B
- Border: #E2E8F0
- Primary action: #111827
- Primary action hover: #273244
- Accent (sparingly): #4F46E5
- Accent soft: #EEF2FF
- Success: #15803D
- Warning: #B45309
- Error: #B91C1C
- Focus ring: #6366F1

Dark mode optional after MVP. Do not use colorful gradients, glassmorphism, unnecessary shadows, or dashboard card overload.

### Typography
- Font: Inter, with system-ui fallback (downloadable/self-hosted only when license permits); default system UI is acceptable for offline mode.
- Main heading: 28px / 36px, weight 650-700
- Page heading: 24px / 32px, weight 650
- Section heading: 18px / 26px, weight 600
- Body: 14-16px / 22-24px, weight 400
- Caption/metadata: 12-13px / 18px
- Code & file names: ui-monospace, 13px

### Spacing and shape
- 4px spacing base; commonly 8, 12, 16, 24, 32px.
- Sidebar width 240px expanded; 64px collapsed.
- Content max-width 1200px; reading/editor column 760-840px.
- Border radius: cards 12px, controls 8px, modals 14px.
- Buttons min-height 40px desktop, 44px mobile.
- Thin 1px borders and subtle elevation for menus/dialogs only.
- Motion: 150-220ms; support prefers-reduced-motion.

### Component inventory
Button (primary/secondary/ghost/destructive), input, textarea, select, combobox, tabs, breadcrumbs, sidebar, drawer, toast, alert, badge, dropdown, modal, confirmation dialog, command palette (P1), document editor, task row, document status chip, AI model switcher, generation progress, empty state, skeleton, connection indicator.

## 4. Screens & layout
### A. Overview / dashboard
- Header: 'Good to see you' or simple 'Overview', New Project action.
- Recent projects as clean list/cards (name, updated at, current stage, next action).
- 'Continue where you left off' section, one prominent CTA.
- AI status compact and non-intrusive.
- Empty state: Create your first project; brief explanation and one CTA.

### B. Projects
- Search, simple status filter, New Project button.
- Responsive list, no mandatory complex grid.
- Item actions: Open, Duplicate (P1), Archive, Delete (confirmation).

### C. Create Project
- Short step-by-step wizard: (1) What are you building? (2) Who is it for? (3) Preferred stack & constraints (optional) (4) Review.
- Provide 'Skip optional questions'. Save draft safely.

### D. Project Overview
- Title, short description, project stage.
- Primary CTA 'Continue Planning' / 'Review PRD' / 'Export to OpenCode' depending on state.
- Documents checklist, open tasks, latest AI activity.
- Avoid artificial completion percentages unless based on explicit checklist.

### E. AI Planning
Desktop: left steps panel (Brief, PRD, User Flow, Technical Spec, Test Plan, Tasks & AGENTS); center markdown document editor/preview; right slim contextual AI panel optionally collapsible.
Mobile: one pane at a time: steps selector -> editor -> AI assistant sheet.
Workflow: ideation -> follow-up questions -> generate draft -> review differences -> user edit -> approve -> export.
States: not started, generating, draft, reviewed, approved, failed; approved docs are not silently overwritten.

### F. Design Studio (P1)
- Subnav: Design Brief, Sitemap, Screens, Components, Design Tokens, Preview.
- Left screen list; center preview/canvas; right properties drawer desktop.
- Mobile shows preview with tabs for screen selection and settings.
- Generate first wireframes; prototype HTML/CSS is explicitly marked experimental.
- Every screen references its PRD feature/requirement IDs.

### G. AI Chat
- Conversation list and chat messages; composer fixed at bottom of its panel.
- Top: model picker (Ollama default), local/remote indicator.
- Context chips for attached project docs; user explicitly chooses them.
- Streaming stop, retry, copy, insert to draft (requires confirmation).
- Empty/chat error/disconnected states.

### H. Templates (P1)
- Search, category and framework filters; simple cards: name, stack, what it includes, Preview, Use Template.
- Clearly mark built-in templates. Never imply premium third-party template content is included.

### I. Tasks / OpenCode Handoff
- Tasks list with status, priority, dependencies, acceptance criteria.
- Detail drawer for each task.
- Export panel previews included files and location. Require user approval before writing outside workspace.

### J. Settings
- AI Providers: Ollama URL, test connection, available models, default model.
- Storage: database path, exports path, backups.
- Interface: theme (later), density (later).
- Security: permissions and safeguards for file writes.

## 5. Responsive behavior
- >= 1280px: full sidebar, optional contextual right panel.
- 768-1279px: collapsible sidebar; editor centered; right panel as drawer.
- < 768px: drawer navigation, single content column, stacked forms; sticky bottom primary action only where useful.
- Minimum supported viewport target: 320px; no horizontal page overflow.
- Touch targets at least 44x44px where feasible.
- Dialogs become full-height sheets on small phones.
- Document editor remains usable with horizontal overflow confined to code blocks/tables.

## 6. UX interactions
- Destructive actions require explicit confirmation and describe impact.
- Generate actions show streaming/progress and cancellation where supported.
- Unsaved edits indicated; autosave drafts with clear save status or explicit save, never silently discard changes.
- Errors are actionable: 'Ollama not connected — Check local service' + retry; no raw stack traces in UI.
- AI output labeled as draft until the user approves it.
- Status chips: Draft (neutral), Reviewed (accent), Approved (green).
- Loading uses skeletons for content, spinners only for short inline actions.
- Document export provides preview manifest before file write.
- Empty states explain the next useful action, not just 'No data'.

## 7. Accessibility
- Target WCAG 2.2 AA for contrast and interaction patterns.
- Semantic landmarks and headings; all buttons named.
- Consistent focus outlines, keyboard accessible menus/dialogs.
- Form errors visible and announced; never rely on color alone.
- Reduced motion settings respected.
- Theme and status colors must pass contrast checks before shipping.

## 8. Data and trust UX
- Local-first badge states exactly whether inference is local or remote.
- Cloud provider use requires opt-in with a warning that selected context will be sent to provider.
- API keys never displayed in full or stored in browser local storage; secured in backend configuration.
- No automatic repo/file changes without approval.
- Explain when referenced docs are out of date after PRD edits.

## 9. Definition of done for each screen
- Works at 320px, 390px, 768px, 1024px, and 1440px.
- Supports keyboard + touch, loading/empty/success/error states.
- Clear primary CTA, no dead-end flows.
- Accessible labels, focus order and contrast validated.
- Real backend integrations or clearly labeled mock data; no fake success messages.
- Matches approved design tokens and components.

## 10. Delivery and implementation notes
Suggested build order: design tokens -> shell/sidebar -> dashboard -> project wizard -> planning document editor -> AI chat -> handoff export -> design studio -> templates. UI must be original and not trace/trade on website reference branding. Before coding, derive screen-level tickets and precise functional acceptance criteria from this document and the product PRD.
