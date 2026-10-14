/**
 * Runs the tests of one exercise: `pnpm exercise R2`. Tests carry the ids of the exercises they
 * check in their names, e.g. "[R2] PATCH and DELETE /api/lists/:id". MongoDB exercises (M...)
 * run on MongoDB: start it first (`docker compose up`).
 */
import { spawnSync } from "node:child_process";

const id = process.argv[2]?.toUpperCase();
if (!id || !/^[RMG]\d$/.test(id)) {
  console.error("Usage: pnpm exercise <id>, for example: pnpm exercise R2");
  process.exit(1);
}
const env = { ...process.env, ...(id.startsWith("M") && { TEST_STORE: "mongodb" }) };
const { status } = spawnSync(process.execPath, ["--test", `--test-name-pattern=\\[${id}\\]`, "test/**/*.test.ts"], {
  cwd: new URL("..", import.meta.url),
  env,
  stdio: "inherit",
});
process.exit(status ?? 1);
