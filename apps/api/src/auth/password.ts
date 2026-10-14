/**
 * Password hashing with scrypt, built into Node. scrypt is slow and memory-hard on purpose,
 * so brute-forcing a leaked hash is expensive. Never store the password itself.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;

// Cost parameters (Node's defaults). They are stored with each hash, so they can be raised later.
const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 32;

/** Returns "scrypt$N$r$p$salt$hash", salt and hash in base64url. */
export async function hashPassword(password: string) {
  // A random salt per user: two users with the same password get different hashes.
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, rr, pp, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  // Constant-time comparison: the response time doesn't reveal how many bytes matched.
  return timingSafeEqual(actual, expected);
}
