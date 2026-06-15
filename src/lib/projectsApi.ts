import seedJson from "@/data/seed-projects.json";
import type { Project, ProjectsResponse } from "@/lib/types";

const seedProjects = (seedJson as { projects: Project[] }).projects;

// Bump suffix whenever the project shape changes — old caches become invalid.
// v5: VAT (18%) is now added on top of the API's pre-VAT PricePerUnit.
const CACHE_KEY = "mehir-matara:projects-cache:v5";
/** Cached data older than this is dropped (so a one-year-old cache doesn't show). */
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface CachedEnvelope {
  cachedAt: number;
  payload: ProjectsResponse;
}

/**
 * Synchronously read the last good response from localStorage. Returns null
 * if no cache, malformed, or stale. Safe to call before any fetch — lets the
 * UI render instantly while the live fetch runs in the background.
 */
export function readCachedProjects(): ProjectsResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as CachedEnvelope;
    if (
      !env ||
      typeof env.cachedAt !== "number" ||
      Date.now() - env.cachedAt > CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    if (!env.payload || !Array.isArray(env.payload.projects)) return null;
    return { ...env.payload, source: env.payload.source ?? "seed" };
  } catch {
    return null;
  }
}

function writeCache(payload: ProjectsResponse) {
  if (typeof window === "undefined") return;
  try {
    const env: CachedEnvelope = { cachedAt: Date.now(), payload };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch {
    // Quota exceeded / disabled — ignore. Worst case is the next reload is slow.
  }
}

/**
 * Fetch from /api/projects (Vercel serverless function or Vite dev middleware).
 * Falls back to bundled seed JSON on failure. Successful responses are cached
 * in localStorage so the next page load is instant.
 */
export async function fetchProjects(): Promise<ProjectsResponse> {
  try {
    const res = await fetch("/api/projects", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as ProjectsResponse;
    if (!data || !Array.isArray(data.projects)) {
      throw new Error("malformed response");
    }
    writeCache(data);
    return data;
  } catch (err) {
    return {
      projects: seedProjects,
      fetchedAt: new Date().toISOString(),
      source: "seed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getSeedProjects(): Project[] {
  return seedProjects;
}

/** Wipe the cache. Useful from devtools: `localStorage.removeItem(...)`. */
export function clearProjectsCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CACHE_KEY);
}
