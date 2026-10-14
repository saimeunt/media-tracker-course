import { operationName } from "~/lib/graphql";

/**
 * Shows the API calls a page made, to connect what's on screen with the requests behind it.
 * REST calls are "METHOD /path" strings; GraphQL operations show their query.
 */
export function ApiCalls({ calls, operations = [] }: { calls: string[]; operations?: string[] }) {
  return (
    <aside className="flex flex-col gap-1 rounded-lg border border-dashed p-3 font-mono text-xs text-muted-foreground">
      <span className="font-sans font-medium">API calls for this page (see the Network tab)</span>
      {calls.map((call) => (
        <code key={call} className="break-all">
          {call}
        </code>
      ))}
      {operations.map((query) => (
        <details key={query}>
          <summary className="cursor-pointer">POST /graphql: {operationName(query)}</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{query.trim()}</pre>
        </details>
      ))}
    </aside>
  );
}
