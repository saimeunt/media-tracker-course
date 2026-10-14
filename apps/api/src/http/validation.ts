import type { Request } from "express";
import type { z } from "zod";
import type { ValidationIssue } from "@media-tracker/shared";
import { HttpError } from "./problem.ts";

/** Turns Zod issues into problem details entries, pointing at the invalid body field. */
export function toBodyIssues(error: z.ZodError): ValidationIssue[] {
  // TODO R3: one issue per Zod issue, with a JSON Pointer to the field (e.g. "#/items/0/mediaId") and the message
  return [];
}

/**
 * Validates a JSON request body.
 * 415 when it isn't JSON, 422 when it is JSON but doesn't match the schema.
 */
export function parseBody<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  if (!req.is("application/json")) {
    throw new HttpError(415, "Send the body as JSON, with Content-Type: application/json");
  }
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new HttpError(422, "The request body is invalid", { errors: toBodyIssues(result.error) });
  }
  return result.data;
}

/** Validates query parameters. 400 when one is invalid. */
export function parseQuery<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({ parameter: String(issue.path[0] ?? ""), detail: issue.message }));
    throw new HttpError(400, "Invalid query parameters", { errors });
  }
  return result.data;
}
