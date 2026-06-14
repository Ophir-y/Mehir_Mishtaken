import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  LIVE_ENDPOINT,
  LIVE_HEADERS,
  liveToProjects,
} from "./src/lib/dira";

/**
 * Dev-server middleware that mirrors api/projects.ts so `npm run dev` shows
 * live data — not just the bundled seed JSON. On failure (WAF, network),
 * returns 502 and the frontend falls back to seed automatically.
 */
function diraDevApi() {
  return {
    name: "dira-dev-api",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            req: IncomingMessage,
            res: ServerResponse,
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use(
        "/api/projects",
        async (
          _req: IncomingMessage,
          res: ServerResponse,
          _next: () => void,
        ) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          try {
            const upstream = await fetch(LIVE_ENDPOINT, {
              method: "GET",
              headers: LIVE_HEADERS,
              signal: AbortSignal.timeout(8000),
            });
            if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
            const json = await upstream.json();
            const projects = liveToProjects(json);
            if (projects.length === 0) throw new Error("empty live result");
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                projects,
                fetchedAt: new Date().toISOString(),
                source: "live",
              }),
            );
          } catch (err) {
            // Let the client fall back to its bundled seed by returning a
            // non-2xx — but include a friendly body for the network tab.
            res.statusCode = 502;
            res.end(
              JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), diraDevApi()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
