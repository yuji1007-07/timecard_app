// 旧システム（Flask / Werkzeug）のパスワードハッシュを検証する。
// 移行直後はスタッフのパスワードが Werkzeug 形式のまま残るため、
// 初回ログイン時にこれで照合し、成功したら bcrypt に置き換える。
import { createHash, pbkdf2Sync, scryptSync, timingSafeEqual } from "crypto";

export function isLegacyHash(hash: string): boolean {
  return hash.startsWith("pbkdf2:") || hash.startsWith("scrypt:");
}

/** Werkzeug の check_password_hash と同じ判定 */
export function verifyLegacyPassword(password: string, stored: string): boolean {
  try {
    const [method, salt, hashHex] = stored.split("$");
    if (!method || !salt || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");

    if (method.startsWith("pbkdf2:")) {
      // pbkdf2:sha256:600000
      const [, algo, iterStr] = method.split(":");
      const iterations = Number(iterStr || 260000);
      const derived = pbkdf2Sync(password, salt, iterations, expected.length, algo || "sha256");
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    }

    if (method.startsWith("scrypt:")) {
      // scrypt:32768:8:1
      const [, nStr, rStr, pStr] = method.split(":");
      const N = Number(nStr || 32768);
      const r = Number(rStr || 8);
      const p = Number(pStr || 1);
      const derived = scryptSync(password, salt, expected.length, { N, r, p, maxmem: 256 * 1024 * 1024 });
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    }

    if (method === "sha256" || method === "md5") {
      const derived = createHash(method).update(salt + password).digest();
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    }
  } catch {
    return false;
  }
  return false;
}
