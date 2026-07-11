import "server-only";
import { inngestClient } from "./client";

/**
 * The only way business modules trigger async work — see CLAUDE.md §2
 * ("No Redis, no BullMQ... async work goes through a job-provider
 * abstraction, not a hand-rolled queue"). Never call embedding/extraction
 * work inline in a request handler; enqueue it here and let the
 * corresponding Inngest function (see modules/knowledge/jobs.ts) pick it up
 * out-of-band.
 */
export async function enqueueJob(name: string, data: Record<string, unknown>): Promise<void> {
  await inngestClient.send({ name, data });
}
