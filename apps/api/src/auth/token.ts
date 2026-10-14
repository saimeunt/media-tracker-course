/**
 * JSON Web Tokens: a signed, readable (not encrypted) payload. The server trusts a token
 * because only it knows the secret that signs it, so it needs no session storage.
 */
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config.ts";

/** How long a sign-in lasts. */
export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function signToken(userId: string) {
  // "sub" (subject) is the standard claim for who the token is about.
  return jwt.sign({}, jwtSecret!, { subject: userId, expiresIn: TOKEN_TTL_SECONDS, algorithm: "HS256" });
}

/** The user id, or null when the token is invalid, tampered with or expired. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, jwtSecret!, { algorithms: ["HS256"] });
    return typeof payload === "object" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
