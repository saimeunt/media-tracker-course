/** One error of a GraphQL response. `extensions.code` says what kind (UNAUTHENTICATED, NOT_FOUND...). */
export interface GraphQLErrorItem {
  message: string;
  path?: (string | number)[];
  extensions?: { code?: string };
}

/** A GraphQL response with errors. */
export class GraphQLRequestError extends Error {
  readonly errors: GraphQLErrorItem[];
  readonly code: string | undefined;

  constructor(errors: GraphQLErrorItem[]) {
    super(errors.map((error) => error.message).join("; "));
    this.errors = errors;
    this.code = errors[0]?.extensions?.code;
  }
}

/**
 * Sends a GraphQL operation. No client library needed: it's a POST to /graphql with the
 * query and its variables as JSON, and the answer is JSON with `data` and maybe `errors`.
 * The session cookie goes along, like with any request to the same origin.
 */
export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: GraphQLErrorItem[] };
  if (body.errors?.length) throw new GraphQLRequestError(body.errors);
  return body.data!;
}

/** The operation's name, e.g. "MediaReviews" for `query MediaReviews(...)`, for display. */
export function operationName(query: string) {
  return /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? "anonymous";
}
