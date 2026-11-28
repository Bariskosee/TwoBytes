import "server-only";
import { createHash, createHmac } from "node:crypto";

// Crockford base32: karışan karakterler (I, L, O, U) yok.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function secret(): string {
  const value = process.env.TRACKING_CODE_SECRET;
  if (!value || value.length < 32) {
    throw new Error("TRACKING_CODE_SECRET must be set (at least 32 characters)");
  }
  return value;
}

/**
 * Gönderim kimliğinden takip kodunu türetir. Aynı kimlik her zaman aynı kodu
 * verir; böylece ağ tekrarı aynı kodu döndürür. Biçim: XXXX-XXXX-XXXX (60 bit).
 */
export function deriveTrackingCode(submissionId: string): string {
  const digest = createHmac("sha256", secret())
    .update(submissionId.toLowerCase())
    .digest();
  // Özetin ilk 60 bitini 5'er bitlik gruplara böl.
  let out = "";
  let buffer = 0;
  let bufferBits = 0;
  let byte = 0;
  while (out.length < 12) {
    if (bufferBits < 5) {
      buffer = ((buffer << 8) | digest[byte++]) & 0xfff;
      bufferBits += 8;
    }
    bufferBits -= 5;
    out += ALPHABET[(buffer >> bufferBits) & 31];
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

/** Kullanıcının yazdığı kodu karşılaştırılabilir biçime getirir. */
export function normalizeTrackingCode(input: string): string | null {
  const raw = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (raw.length !== 12 || [...raw].some((c) => !ALPHABET.includes(c))) {
    return null;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Veritabanında saklanan özet; kodun kendisi saklanmaz. */
export function hashTrackingCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Günlüklerde kod ve gönderim kimliğini maskeler. */
export function mask(value: string): string {
  return value.length <= 4 ? "****" : `${value.slice(0, 2)}…${value.slice(-2)}`;
}
