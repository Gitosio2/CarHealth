import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { taskTypes } from '../schema/maintenance';

export interface SharedTaskType {
  name: string;
  intervalKm?: number;
  intervalMonths?: number;
}

/**
 * The catalog every profile sees, stored with `profileId = null`.
 *
 * Intervals are conservative defaults, not manufacturer truth: a schedule
 * overrides them per vehicle, because the car's own manual outranks any
 * generic figure. Every entry carries at least one interval — an entry with
 * neither can never produce a reminder, which is the point of the catalog.
 */
export const SHARED_TASK_TYPES: readonly SharedTaskType[] = [
  { name: 'Oil and oil filter change', intervalKm: 15_000, intervalMonths: 12 },
  { name: 'Air filter replacement', intervalKm: 30_000, intervalMonths: 24 },
  { name: 'Cabin filter replacement', intervalKm: 30_000, intervalMonths: 12 },
  { name: 'Fuel filter replacement', intervalKm: 60_000, intervalMonths: 48 },
  { name: 'Spark plug replacement', intervalKm: 60_000, intervalMonths: 48 },
  { name: 'Timing belt replacement', intervalKm: 120_000, intervalMonths: 120 },
  { name: 'Brake pad replacement', intervalKm: 40_000 },
  { name: 'Brake disc replacement', intervalKm: 80_000 },
  { name: 'Brake fluid change', intervalMonths: 24 },
  { name: 'Coolant change', intervalKm: 90_000, intervalMonths: 48 },
  { name: 'Transmission oil change', intervalKm: 100_000, intervalMonths: 96 },
  { name: 'Tyre replacement', intervalKm: 50_000 },
  { name: 'Wheel alignment', intervalKm: 30_000, intervalMonths: 24 },
  { name: 'Battery replacement', intervalMonths: 60 },
  { name: 'Wiper blade replacement', intervalMonths: 12 },
  { name: 'Roadworthiness inspection (ITV)', intervalMonths: 12 },
];

/**
 * Idempotent: it is expected to run on every deploy, and running it twice must
 * not duplicate the catalog or overwrite an interval anyone customised.
 *
 * Idempotency rests on the partial unique index over shared names. A private
 * task carrying the same name lives in a different namespace and is untouched.
 */
export async function seedTaskTypeCatalog<
  TSchema extends Record<string, unknown>,
>(db: NodePgDatabase<TSchema>): Promise<void> {
  await db
    .insert(taskTypes)
    .values(
      SHARED_TASK_TYPES.map((entry) => ({
        profileId: null,
        name: entry.name,
        intervalKm: entry.intervalKm ?? null,
        intervalMonths: entry.intervalMonths ?? null,
      })),
    )
    .onConflictDoNothing();
}
