import { Router } from "express";
import type { HealthResponse } from "@media-tracker/shared";
import type { Store } from "../store/types.ts";

export function healthRouter(store: Store) {
  const router = Router();

  router.get("/health", async (_req, res) => {
    // Check the storage too, so the health check fails when the database is down.
    await store.ping();
    const body: HealthResponse = { ok: true };
    res.json(body);
  });

  return router;
}
