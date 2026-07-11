/**
 * Minimal in-memory sliding-window limiter — "rate limit preparation" for
 * the public widget endpoints (module spec §9 / CLAUDE.md §4 & §6). This is
 * intentionally NOT a distributed limiter: CLAUDE.md bans Redis/BullMQ in
 * Phase 1, so a shared-store limiter is out of scope here. Per-instance-only
 * is a real, disclosed limitation — behind a load balancer with multiple
 * instances, each instance enforces its own window rather than a global
 * one. Sufficient to blunt casual abuse from a single source; not a
 * substitute for a real edge/WAF-level limiter in production.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(identifier: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(identifier);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}
