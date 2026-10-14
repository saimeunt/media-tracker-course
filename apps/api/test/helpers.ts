import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { after } from "node:test";
import { createApp } from "../src/app.ts";
import { createMemoryStore } from "../src/store/memory/index.ts";
import type { Store } from "../src/store/types.ts";

export type Api = (path: string, init?: RequestInit) => Promise<Response>;

/** The store the tests run against: TEST_STORE=mongodb runs them on MongoDB (MONGODB_URI). */
async function createTestStore(): Promise<Store> {
  if (process.env.TEST_STORE !== "mongodb") return createMemoryStore();
  throw new Error("TEST_STORE=mongodb: MongoDB comes in module 2");
}

/**
 * Starts the API on a random free port with a fresh store, for the current test file.
 * Returns `api(path, init)`, a fetch bound to that server. The server starts on the first
 * request, so a file whose tests are all filtered out (`pnpm exercise R2`) starts nothing.
 */
export function startApi({ corsOrigins = [], wrapStore = (store: Store) => store }: { corsOrigins?: string[]; wrapStore?: (store: Store) => Store } = {}): Api {
  let started: Promise<{ url: string; close: () => Promise<void> }> | undefined;
  const start = () =>
    (started ??= createTestStore().then(async (store) => {
      const server = (await createApp(wrapStore(store), { corsOrigins })).listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      return {
        url: `http://localhost:${(server.address() as AddressInfo).port}`,
        async close() {
          server.close();
          await store.close();
        },
      };
    }));
  after(async () => {
    await (await started)?.close();
  });

  return async (path, init) => fetch((await start()).url + path, init);
}

/** Init for a request with a JSON body. */
export function json(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) };
}

/** Fixture users (see src/store/memory/fixtures.ts). */
export const ALICE = { id: "66f4a1000000000000000001", email: "alice@example.com", password: "password123" };
export const BOB = { id: "66f4a1000000000000000002", email: "bob@example.com", password: "password123" };

/** Signs in and returns the headers that send the session cookie, like a browser would. */
export async function signIn(api: Api, { email, password }: { email: string; password: string }) {
  const res = await api("/api/auth/login", json("POST", { email, password }));
  assert.equal(res.status, 200);
  const cookie = res.headers.getSetCookie()[0]!.split(";")[0]!;
  return { Cookie: cookie };
}

