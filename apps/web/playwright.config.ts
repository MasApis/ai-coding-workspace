import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const E2E_DB = join(mkdtempSync(join(tmpdir(), "e2e-")), "workspace.sqlite");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @workspace/api start",
      env: { DB_PATH: E2E_DB },
      port: 3001,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "pnpm --filter @workspace/web dev",
      port: 5173,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
