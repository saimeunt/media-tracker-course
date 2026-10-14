import { STATUS_CODES } from "node:http";
import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import type { ProblemDetails } from "@media-tracker/shared";

/** Throw it from a route handler: the error handler turns it into a problem details response. */
export class HttpError extends Error {
  readonly status: number;
  readonly extensions: Partial<ProblemDetails>;

  constructor(status: number, detail?: string, extensions: Partial<ProblemDetails> = {}) {
    super(detail ?? STATUS_CODES[status]);
    this.status = status;
    this.extensions = extensions;
  }
}

/**
 * Stands in for the code of an exercise in the student starters (the generator inserts the
 * calls): the request fails with 501 Not Implemented until the exercise is done.
 */
export function todo(exercise: string): never {
  throw new HttpError(501, `Exercise ${exercise} is not done yet`);
}

/** Sends an RFC 9457 problem details body. */
export function sendProblem(res: Response, status: number, detail?: string, extensions: Partial<ProblemDetails> = {}) {
  const body: ProblemDetails = {
    type: "about:blank",
    title: STATUS_CODES[status] ?? "Error",
    status,
    ...(detail && { detail }),
    ...extensions,
  };
  res.status(status).type("application/problem+json").json(body);
}

/** Fallback for /api/* URLs that no route matched. */
export const notFound: RequestHandler = (req, res) => {
  sendProblem(res, 404, `No route for ${req.method} ${req.baseUrl}${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    sendProblem(res, err.status, err.message, err.extensions);
    return;
  }
  // Errors from express.json(): malformed JSON (400), body too large (413)...
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
    const detail = err.type === "entity.parse.failed" ? "The request body is not valid JSON" : err.message;
    sendProblem(res, err.status, detail);
    return;
  }
  // Anything else is a bug: log it, and don't leak its details to the client.
  console.error(err);
  sendProblem(res, 500);
};
