import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { taskTypes } from '../../src/database/schema/maintenance';
import {
  SHARED_TASK_TYPES,
  seedTaskTypeCatalog,
} from '../../src/database/seed/task-type-catalog';
import { startTestPostgres } from '../support/postgres';
import type { TestDatabase, TestPostgres } from '../support/postgres';

let postgres: TestPostgres;
let db: TestDatabase;

beforeAll(async () => {
  postgres = await startTestPostgres();
  db = postgres.db;
});

afterAll(async () => {
  await postgres?.stop();
});

beforeEach(async () => {
  await db.delete(taskTypes);
});

describe('seedTaskTypeCatalog', () => {
  it('inserts the shared catalog', async () => {
    await seedTaskTypeCatalog(db);

    const rows = await db
      .select()
      .from(taskTypes)
      .where(isNull(taskTypes.profileId));

    expect(rows).toHaveLength(SHARED_TASK_TYPES.length);
    expect(rows.map((row) => row.name).sort()).toEqual(
      SHARED_TASK_TYPES.map((entry) => entry.name).sort(),
    );
  });

  it('is idempotent, so it can run on every boot and on every migration', async () => {
    await seedTaskTypeCatalog(db);
    await seedTaskTypeCatalog(db);

    const rows = await db.select().from(taskTypes);

    expect(rows).toHaveLength(SHARED_TASK_TYPES.length);
  });

  it('does not overwrite an interval that was changed after seeding', async () => {
    // Re-seeding runs on every deploy. If it reset intervals, any correction
    // made to the shared catalog would silently revert on the next release.
    await seedTaskTypeCatalog(db);
    const [seeded] = SHARED_TASK_TYPES;
    await db
      .update(taskTypes)
      .set({ intervalKm: 7_500 })
      .where(and(isNull(taskTypes.profileId), eq(taskTypes.name, seeded!.name)));

    await seedTaskTypeCatalog(db);

    const [row] = await db
      .select({ intervalKm: taskTypes.intervalKm })
      .from(taskTypes)
      .where(and(isNull(taskTypes.profileId), eq(taskTypes.name, seeded!.name)));

    expect(row!.intervalKm).toBe(7_500);
  });

  it('ships every entry with at least one interval', async () => {
    // A catalog entry with neither interval can never produce a reminder, and
    // reminders are why the application exists.
    for (const entry of SHARED_TASK_TYPES) {
      expect(
        entry.intervalKm ?? entry.intervalMonths,
        `${entry.name} has no interval`,
      ).toBeDefined();
    }
  });
});
