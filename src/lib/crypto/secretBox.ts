import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM envelope for integration credentials.
 * Format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
 * Key comes from INTEGRATION_ENC_KEY (32-byte base64/hex/plain — hashed to 32B).
 */
function key(): Buffer {
  const secret = process.env.INTEGRATION_ENC_KEY;
  if (!secret) throw new Error("INTEGRATION_ENC_KEY is not configured");
  return Buffer.from(secret.padEnd(64, "0").slice(0, 64), "utf8").subarray(0, 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("bad secret blob");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
