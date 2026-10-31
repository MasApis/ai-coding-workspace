import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Threat model (single local user): the DB file and project exports must
// never contain usable credentials. The AES-256-GCM key lives outside the
// DB (env, or a 0600 file under data/.keys). This does NOT defend against
// same-user malware or root — document, don't oversell.

const KEY_BYTES = 32;
const IV_BYTES = 12;

function findWorkspaceRoot(start: string): string {
  let dir = start;
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export function loadGatewayKey(): Buffer {
  const fromEnv = process.env["AI_GATEWAY_KEY"];
  if (fromEnv !== undefined && fromEnv !== "") {
    const key = Buffer.from(fromEnv, "hex");
    if (key.length !== KEY_BYTES) {
      throw new Error("AI_GATEWAY_KEY must be 32 bytes encoded as 64 hex characters");
    }
    return key;
  }
  const keyPath = resolve(findWorkspaceRoot(process.cwd()), "data", ".keys", "ai-gateway.key");
  if (existsSync(keyPath)) {
    const key = Buffer.from(readFileSync(keyPath, "utf8").trim(), "hex");
    if (key.length !== KEY_BYTES) {
      throw new Error(`gateway key file has invalid length: ${keyPath}`);
    }
    return key;
  }
  mkdirSync(dirname(keyPath), { recursive: true });
  const key = randomBytes(KEY_BYTES);
  writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // Filesystem may not support chmod (e.g. some mounts); content is already written.
  }
  return key;
}

export interface SealedSecret {
  ciphertext: string;
  iv: string;
}

export function sealSecret(plaintext: string, key: Buffer): SealedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([tag, ciphertext]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function openSecret(sealed: SealedSecret, key: Buffer): string {
  const raw = Buffer.from(sealed.ciphertext, "base64");
  const tag = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
