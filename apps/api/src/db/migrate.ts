import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { openDatabase } from "./connection.js";

const DEFAULT_DB_PATH = "./data/workspace.sqlite";

// pnpm --filter runs this script with cwd=apps/api, while DB_PATH in
// .env.example is relative to the workspace root. Anchor relative paths
// at the directory containing pnpm-workspace.yaml so `pnpm db:migrate`
// lands in <root>/data no matter where it is invoked from.
function findWorkspaceRoot(start: string): string {
  let dir = start;
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

function resolveDbPath(raw: string): string {
  const root = findWorkspaceRoot(process.cwd());
  const resolved = resolve(root, raw);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`DB_PATH must resolve inside the workspace directory: ${raw}`);
  }
  return resolved;
}

const dbPath = resolveDbPath(process.env["DB_PATH"] ?? DEFAULT_DB_PATH);
const { close } = openDatabase(dbPath);
close();
console.log(`migrated: ${dbPath}`);
