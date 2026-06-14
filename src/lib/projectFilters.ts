import type { Project } from "@/lib/types";

/**
 * True iff the lottery is currently accepting registrations.
 * - Requires status === "open".
 * - If a close date is also present, enforce it (defends against stale data
 *   where status wasn't updated after the window closed).
 */
export function isOpenForRegistration(
  p: Project,
  now: Date = new Date(),
): boolean {
  if (p.status !== "open") return false;
  if (p.registrationClosesAt) {
    return new Date(p.registrationClosesAt) > now;
  }
  return true;
}

/** Days until registration closes (ceil). Null if no close date. */
export function daysUntilClose(
  p: Project,
  now: Date = new Date(),
): number | null {
  if (!p.registrationClosesAt) return null;
  const ms = new Date(p.registrationClosesAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
