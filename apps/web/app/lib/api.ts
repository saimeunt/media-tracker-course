import type { ProblemDetails } from "@media-tracker/shared";

/** A non-2xx response from the API, with its RFC 9457 problem details body. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.status = problem.status;
    this.problem = problem;
  }
}

interface ApiInit extends Omit<RequestInit, "body"> {
  /** Sent as a JSON body, with Content-Type: application/json. */
  json?: unknown;
  /**
   * The browser's request, when calling from the web server (SSR loaders): its cookie is
   * forwarded so the API knows who is signed in.
   */
  request?: Request;
}

/**
 * Calls the REST API and returns the parsed JSON body (undefined for 204 No Content).
 *
 * In the browser, requests go to /api on the page's own origin, and the Vite dev server
 * forwards them to the API: they show up in the Network tab of the developer tools.
 * On the web server, they go straight to the API (API_URL).
 */
export async function api<T>(path: string, { json, request, ...init }: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  let url = path;
  if (import.meta.env.SSR) {
    url = (process.env.API_URL ?? "http://localhost:4000") + path;
    const cookie = request?.headers.get("Cookie");
    if (cookie) headers.set("Cookie", cookie);
  }

  const res = await fetch(url, { ...init, headers, body: json === undefined ? undefined : JSON.stringify(json) });
  if (!res.ok) {
    const isProblem = res.headers.get("Content-Type")?.includes("application/problem+json");
    throw new ApiError(
      isProblem ? await res.json() : { type: "about:blank", title: res.statusText, status: res.status },
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Field errors of a 4xx problem, by field name: "#/name" becomes "name". */
export function fieldErrors(problem: ProblemDetails | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const error of problem?.errors ?? []) {
    const field = error.pointer?.replace(/^#\/?/, "") ?? error.parameter;
    if (field && !errors[field]) errors[field] = error.detail;
  }
  return errors;
}

/** Runs an API call in an action: returns the problem of a 4xx error so the form can show it. */
export async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; problem: ProblemDetails }> {
  try {
    return { ok: true, data: await call() };
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) return { ok: false, problem: error.problem };
    throw error;
  }
}
