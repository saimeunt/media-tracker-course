import type { CookieOptions, RequestHandler, Response } from "express";
import { TOKEN_TTL_SECONDS, signToken, verifyToken } from "../auth/token.ts";
import { isProduction } from "../config.ts";
import { HttpError } from "./problem.ts";

declare global {
  namespace Express {
    interface Request {
      /** The signed-in user, set by `authenticate`. */
      user?: { id: string };
    }
  }
}

export const TOKEN_COOKIE = "token";

const cookieOptions: CookieOptions = {
  // JavaScript in the page can't read the cookie, so an XSS flaw can't steal the token.
  httpOnly: true,
  // The browser doesn't send the cookie on cross-site POSTs, which blocks CSRF attacks.
  sameSite: "lax",
  // HTTPS only. Local development runs on plain HTTP.
  secure: isProduction,
  path: "/",
};

/** Signs the user in: the browser sends the cookie back on every request. */
export function setTokenCookie(res: Response, userId: string) {
  res.cookie(TOKEN_COOKIE, signToken(userId), { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
}

export function clearTokenCookie(res: Response) {
  res.clearCookie(TOKEN_COOKIE, cookieOptions);
}

/**
 * Sets `req.user` from the token, read from the cookie (browsers) or from an
 * `Authorization: Bearer <token>` header (scripts, mobile apps). No valid token: anonymous.
 * The token is trusted as is, without a database lookup: that's what makes JWTs stateless.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : req.cookies?.[TOKEN_COOKIE];
  const userId = typeof token === "string" ? verifyToken(token) : null;
  if (userId) req.user = { id: userId };
  next();
};

/** 401 when nobody is signed in. Returns the user id. */
export function requireUser(user: Express.Request["user"]): string {
  if (!user) throw new HttpError(401, "Sign in to do this");
  return user.id;
}

/** 403 when the signed-in user doesn't own the resource. */
export function requireOwner(userId: string, ownerId: string) {
  if (userId !== ownerId) throw new HttpError(403, "Only the owner can do this");
}
