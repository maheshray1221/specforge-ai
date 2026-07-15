import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const algorithm = "aes-256-gcm";

function getEncryptionMaterial() {
  return env.INTEGRATION_SECRET_KEY ?? env.JWT_ACCESS_SECRET;
}

function getKey() {
  return createHash("sha256").update(getEncryptionMaterial()).digest();
}

export function getEncryptionKeyFingerprint() {
  return createHash("sha256").update(getEncryptionMaterial()).digest("hex").slice(0, 16);
}

export function encryptSecretValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyFingerprint: getEncryptionKeyFingerprint(),
  };
}

export function decryptSecretValue(input: { encryptedValue: string; iv: string; authTag: string }) {
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
