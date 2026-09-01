import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptSecret, decryptSecret } from "../src/lib/crypto/secretBox";

beforeAll(() => {
  process.env.INTEGRATION_ENC_KEY = "test-key-for-unit-tests-only";
});

afterAll(() => {
  delete process.env.INTEGRATION_ENC_KEY;
});

describe("secretBox (AES-256-GCM credential encryption)", () => {
  it("roundtrips a credential", () => {
    const secret = "ghp_mySuperSecretToken123";
    const blob = encryptSecret(secret);
    expect(blob).not.toContain(secret);
    expect(blob.startsWith("v1.")).toBe(true);
    expect(decryptSecret(blob)).toBe(secret);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encryptSecret("same-secret");
    const b = encryptSecret("same-secret");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("rejects tampered ciphertext", () => {
    const blob = encryptSecret("secret");
    const parts = blob.split(".");
    const data = Buffer.from(parts[3], "base64");
    data[0] ^= 0xff;
    parts[3] = data.toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("rejects malformed blobs", () => {
    expect(() => decryptSecret("garbage")).toThrow();
    expect(() => decryptSecret("v2.a.b.c")).toThrow();
  });
});
