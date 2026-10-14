import { createMemoryStore } from "./memory/index.ts";
import type { Store } from "./types.ts";

/**
 * The store chosen by DATA_STORE: "memory" (module 1) or "mongodb" (from module 2).
 * An empty MongoDB database is seeded on first start.
 */
export async function createStore(kind = process.env.DATA_STORE ?? "memory"): Promise<Store> {
  if (kind === "memory") return createMemoryStore();
  throw new Error(`Unknown DATA_STORE "${kind}": use "memory" (MongoDB comes in module 2)`);
}
