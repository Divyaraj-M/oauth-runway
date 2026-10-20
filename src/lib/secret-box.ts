import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts users' AI provider keys at rest (AES-256-GCM). Not hashing: a hash can't be reversed, and the server
 * has to send the real key to the provider on each request. KEY_ENCRYPTION_SECRET (32 bytes, base64) lives only
 * in server env; the database alone can't decrypt anything. Format: "v1.<iv>.<tag>.<ciphertext>" (base64url).
 */
function secret(): Buffer {
  const raw = process.env.KEY_ENCRYPTION_SECRET ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("KEY_ENCRYPTION_SECRET must be 32 bytes, base64-encoded");
  return key;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("Unrecognized sealed value");
  const decipher = createDecipheriv("aes-256-gcm", secret(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
