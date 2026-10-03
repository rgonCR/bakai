import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEncryptionSecret } from "@/lib/supabase/env";

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM → `iv:tag:ciphertext` em base64url */
export function encryptAsaasKey(plain: string): string {
  const key = keyFromSecret(getEncryptionSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(":");
}

export function decryptAsaasKey(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload de chave inválido");
  }
  const key = keyFromSecret(getEncryptionSecret());
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
