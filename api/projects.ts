// Vercel serverless function — runs on Node 18.
// Endpoint: GET /api/projects
//
// Fetches live data from dira.moch.gov.il and joins it with optional seed
// overrides. On any failure the function still returns 200 with the bundled
// seed JSON so the UI never breaks. The actual scraping + parsing lives in
// src/lib/dira.ts so it's shared with the Vite dev middleware.

import {
  LIVE_ENDPOINT,
  LIVE_HEADERS,
  liveToProjects,
} from "../src/lib/dira.js";
import seedJson from "../src/data/seed-projects.json" with { type: "json" };
import type { Project } from "../src/lib/types.js";

interface VercelRequest {
  method?: string;
  query: Record<string, string | string[]>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  send(body: string): void;
}

const seedProjects = (seedJson as { projects: Project[] }).projects;

/**
 * Optional overrides from seed by lottery number — lets you commit
 * better-than-default per-city market prices, rents, or per-room apartment
 * breakdowns without changing code. Match by `id === "lottery-<num>"`.
 */
function applySeedOverrides(live: Project[]): Project[] {
  if (seedProjects.length === 0) return live;
  const overridesById = new Map<string, Project>();
  for (const s of seedProjects) overridesById.set(s.id, s);
  return live.map((p) => {
    const o = overridesById.get(p.id);
    if (!o) return p;
    const mergedApartments = o.apartments.length ? o.apartments : p.apartments;
    return {
      ...p,
      apartments: mergedApartments.map((a, i) => {
        const liveA = p.apartments[i];
        if (!liveA) return a;
        return {
          ...liveA,
          marketPrice: a.marketPrice || liveA.marketPrice,
          estimatedRent: a.estimatedRent || liveA.estimatedRent,
        };
      }),
    };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=900, stale-while-revalidate=3600",
  );
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const allowLive = req.query.skipLive !== "1";
  if (!allowLive) {
    res.status(200).json({
      projects: seedProjects,
      fetchedAt: new Date().toISOString(),
      source: "seed",
      reason: "skipLive=1",
    });
    return;
  }

  try {
    const upstream = await fetch(LIVE_ENDPOINT, {
      method: "GET",
      headers: LIVE_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const json = await upstream.json();
    const live = liveToProjects(json);
    if (live.length === 0) throw new Error("empty live result");
    const projects = applySeedOverrides(live);
    res.status(200).json({
      projects,
      fetchedAt: new Date().toISOString(),
      source: "merged",
    });
  } catch (err) {
    res.status(200).json({
      projects: seedProjects,
      fetchedAt: new Date().toISOString(),
      source: "seed",
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}
