import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { todo } from "./problem.ts";

/** A strong validator: a hash of the exact bytes of the representation. */
export function computeEtag(body: string) {
  return `"${createHash("sha1").update(body).digest("base64url")}"`;
}

/**
 * Does an If-None-Match header match this ETag? The header holds "*" or a list of
 * ETags, and If-None-Match compares them weakly: a W/ prefix is ignored (RFC 9110, 13.1.2).
 */
export function etagMatches(ifNoneMatch: string | undefined, etag: string) {
  // TODO R5: true when the header is "*" or one of its comma-separated ETags equals this one, ignoring W/
  todo("R5");
}

/**
 * Sends a JSON body with an ETag, or 304 Not Modified when the client's copy is current.
 * Express can do this on its own; the app turns that off (`app.set("etag", false)`) to show how it works.
 */
export function sendCacheable(req: Request, res: Response, body: unknown) {
  // TODO R5: set the ETag header (computeEtag), answer 304 without a body when If-None-Match matches it
  res.json(body);
}
