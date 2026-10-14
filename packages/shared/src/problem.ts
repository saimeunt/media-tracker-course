/**
 * Error body returned by the API, following RFC 9457 "Problem Details for HTTP APIs".
 * Sent with `Content-Type: application/problem+json`.
 */
export interface ProblemDetails {
  /** URI identifying the problem type; "about:blank" means "see the status code". */
  type: string;
  /** Short summary of the problem type (the status text for "about:blank"). */
  title: string;
  status: number;
  /** Explanation specific to this occurrence. */
  detail?: string;
  /** Extension: one entry per invalid field (body) or query parameter. */
  errors?: ValidationIssue[];
}

export interface ValidationIssue {
  /** JSON Pointer (RFC 6901) to the invalid body field, e.g. "#/items/0/mediaId". */
  pointer?: string;
  /** Name of the invalid query parameter. */
  parameter?: string;
  detail: string;
}
