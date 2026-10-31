import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// IDs are TEXT UUIDs generated in app code (crypto.randomUUID()).
// Timestamps are INTEGER milliseconds UTC; the API boundary converts to ISO-8601.
// JSON columns are TEXT holding JSON strings; parsed at the service layer.
// Allowed values are documented per column; enforced at the service layer (TICKET-006).

function lifecycle() {
  return {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  };
}

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    ideaMd: text("idea_md"),
    stackJson: text("stack_json"),
    // active | archived
    state: text("state").notNull().default("active"),
    ...lifecycle(),
  },
  (t) => [index("projects_updated_at_idx").on(t.updatedAt)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    // PROJECT_BRIEF | PRD | USER_FLOW | TECHNICAL_SPEC | TEST_PLAN | TASKS | AGENTS
    type: text("type").notNull(),
    title: text("title").notNull(),
    // draft | reviewed | approved
    approvalState: text("approval_state").notNull().default("draft"),
    // No hard FK: bound to an exact version id by the service layer (TICKET-009).
    currentVersionId: text("current_version_id"),
    // Set on approval; cleared when a new draft is created from the approved version.
    approvedVersionId: text("approved_version_id"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    upstreamManifestJson: text("upstream_manifest_json"),
    ...lifecycle(),
  },
  (t) => [
    index("documents_project_id_idx").on(t.projectId),
    index("documents_updated_at_idx").on(t.updatedAt),
  ],
);

export const documentVersions = sqliteTable(
  "document_versions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    contentMd: text("content_md").notNull(),
    // ai | user | import
    origin: text("origin").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("document_versions_doc_version_uq").on(t.documentId, t.versionNo),
    index("document_versions_document_id_idx").on(t.documentId),
  ],
);

export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    rationale: text("rationale"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("decisions_project_id_idx").on(t.projectId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    ticketKey: text("ticket_key"),
    title: text("title").notNull(),
    descriptionMd: text("description_md"),
    priority: text("priority"),
    state: text("state"),
    dependencyKeysJson: text("dependency_keys_json"),
    acceptanceJson: text("acceptance_json"),
    ...lifecycle(),
  },
  (t) => [
    index("tasks_project_id_idx").on(t.projectId),
    index("tasks_updated_at_idx").on(t.updatedAt),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    title: text("title"),
    ...lifecycle(),
  },
  (t) => [index("conversations_project_id_idx").on(t.projectId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // user | assistant | system
    role: text("role").notNull(),
    contentMd: text("content_md").notNull(),
    providerId: text("provider_id"),
    modelId: text("model_id"),
    contextManifestJson: text("context_manifest_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("messages_conversation_id_idx").on(t.conversationId)],
);

export const providerConfigs = sqliteTable(
  "provider_configs",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    // openai-compatible | openai | anthropic | gemini | ollama
    protocol: text("protocol").notNull(),
    baseUrl: text("base_url"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    ...lifecycle(),
  },
  (t) => [index("provider_configs_updated_at_idx").on(t.updatedAt)],
);

// Ciphertext envelope only. The AES-256-GCM key lives outside the DB
// (AI_GATEWAY_KEY env or data/.keys/ai-gateway.key, mode 0600).
export const providerSecrets = sqliteTable(
  "provider_secrets",
  {
    providerId: text("provider_id")
      .primaryKey()
      .references(() => providerConfigs.id, { onDelete: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("provider_secrets_created_at_idx").on(t.createdAt)],
);

export const modelPresets = sqliteTable(
  "model_presets",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerConfigs.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    label: text("label"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("model_presets_provider_id_idx").on(t.providerId)],
);

export const aiPreferences = sqliteTable(
  "ai_preferences",
  {
    id: text("id").primaryKey(),
    // global | project
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id"),
    providerId: text("provider_id")
      .notNull()
      .references(() => providerConfigs.id),
    modelId: text("model_id").notNull(),
  },
  (t) => [index("ai_preferences_scope_idx").on(t.scopeType, t.scopeId)],
);

// Write path belongs to the gateway (AI-025/AI-028). provider_id is
// deliberately not a FK: history survives provider deletion.
export const aiRequests = sqliteTable(
  "ai_requests",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    errorCode: text("error_code"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
  },
  (t) => [
    index("ai_requests_project_id_idx").on(t.projectId),
    index("ai_requests_started_at_idx").on(t.startedAt),
  ],
);

export const exports = sqliteTable(
  "exports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    manifestJson: text("manifest_json").notNull(),
    relativeFilePath: text("relative_file_path").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("exports_project_id_idx").on(t.projectId)],
);
