import "server-only";
import { and, gte, lte, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { AnalyticsFilter } from "./validation";

/** Every report defaults to the trailing 30 days when no explicit range is
 * given — wide enough to be useful, narrow enough to stay fast without a
 * materialized/cached aggregate (module spec §13: "prefer aggregating
 * existing data" over adding cache infrastructure this phase doesn't need
 * yet at expected data volumes). */
export const DEFAULT_LOOKBACK_DAYS = 30;

export function resolveDateRange(filter: Pick<AnalyticsFilter, "from" | "to">): { from: Date; to: Date } {
  const to = filter.to ? new Date(filter.to) : new Date();
  const from = filter.from
    ? new Date(filter.from)
    : new Date(to.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Builds the `and(...)`-ready date-range conditions for whichever
 * timestamp column a given table uses — every analytics service has a
 * different "when did this happen" column, so this stays a small per-call
 * helper rather than a one-size-fits-all query builder. */
export function dateRangeConditions(column: PgColumn, filter: Pick<AnalyticsFilter, "from" | "to">): SQL[] {
  const { from, to } = resolveDateRange(filter);
  return [gte(column, from), lte(column, to)];
}

export function combine(...conditions: (SQL | undefined)[]): SQL {
  return and(...conditions.filter((c): c is SQL => c !== undefined))!;
}
