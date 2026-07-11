import { Inngest } from "inngest";

/**
 * The Inngest client instance. Only imported by infrastructure/glue code
 * (the Inngest function definitions and the /api/inngest route handler) —
 * business modules enqueue work through `enqueueJob` in ./index.ts instead,
 * never this client directly. See CLAUDE.md §2.
 */
export const inngestClient = new Inngest({ id: "ai-lead-agent" });
