import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Password hashing with scrypt (node builtin, no native deps).
 * Format: scrypt$N$salt$hash  (salt & hash hex)
 */
const N = 16384;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN, { N }).toString("hex");
  return `scrypt$${N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = parseInt(parts[1], 10);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  const actual = scryptSync(password, salt, expected.length, { N: n });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
