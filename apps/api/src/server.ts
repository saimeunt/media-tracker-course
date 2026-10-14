import { createApp } from "./app.ts";
import { createStore } from "./store/index.ts";

const port = Number(process.env.PORT ?? 4000);

const store = await createStore();
const app = await createApp(store);
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// Close cleanly on Ctrl+C, `docker compose stop` and nodemon restarts.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close();
    void store.close();
  });
}
