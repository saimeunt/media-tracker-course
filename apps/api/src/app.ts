import cookieParser from "cookie-parser";
import express from "express";
import { corsOrigins } from "./config.ts";
import { authenticate } from "./http/auth.ts";
import { cors } from "./http/cors.ts";
import { errorHandler, notFound } from "./http/problem.ts";
import { authRouter } from "./routes/auth.ts";
import { entriesRouter } from "./routes/entries.ts";
import { healthRouter } from "./routes/health.ts";
import { listsRouter } from "./routes/lists.ts";
import { mediaRouter } from "./routes/media.ts";
import { usersRouter } from "./routes/users.ts";
import type { Store } from "./store/types.ts";

/** Builds the Express app on top of a store. Tests build one per file, on a fresh store. */
export async function createApp(store: Store, options = { corsOrigins }) {
  const app = express();
  // Express adds weak ETags to every response on its own; the app sets them explicitly where they help.
  app.set("etag", false);
  app.use(cors(options.corsOrigins));
  app.use(express.json());
  app.use(cookieParser());
  app.use(authenticate);

  app.use("/api", healthRouter(store), authRouter(store), usersRouter(store), entriesRouter(store), mediaRouter(store), listsRouter(store));
  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}
