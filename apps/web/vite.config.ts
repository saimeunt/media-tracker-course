import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Where the dev server forwards API calls: the `api` service in Docker, localhost otherwise.
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // Scan every route up front, so the dependencies they import are bundled at startup rather
  // than discovered during the first visit (which fails those requests with 504 and needs a reload).
  optimizeDeps: { entries: ["./app/**/*.tsx"] },
  server: {
    host: true,
    port: 5173,
    // The browser only talks to this server; API calls are proxied, so there is no CORS in dev.
    proxy: { "/api": apiUrl, "/graphql": apiUrl },
  },
});
