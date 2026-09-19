import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { taskTypes } from './maintenance';
import { vehicles } from './vehicles';

/**
 * There is no reminders table, and this is not one.
 *
 * A reminder is derived when it is read: stored reminders would need
 * recalculating on every maintenance and every odometer reading, and any row
 * that drifts out of sync produces a wrong alert silently.
 *
 * What is stored is the *schedule* — one entity doing three jobs:
 *
 * 1. which catalog tasks to follow on this vehicle (nobody wants alerts for
 *    all forty);
 * 2. an interval that overrides the catalog default, because the car's own
 *    manual outranks a generic figure;
 * 3. a baseline, so registering an eight-year-old car produces useful
 *    reminders on day one rather than after the next workshop visit.
 *
 * Every override column is nullable. All null means: follow this task using
 * the catalog default, counting from real history.
 */
export const vehicleTaskSchedules = pgTable(
  'vehicle_task_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    taskTypeId: uuid('task_type_id')
      .notNull()
      // Deferred by hand in the migration SQL, like `tasks.task_type_id` —
      // see the comment on `tasks` in maintenance.ts for why.
      .references(() => taskTypes.id, { onDelete: 'no action' }),
    intervalKm: integer('interval_km'),
    intervalMonths: integer('interval_months'),
    // A date, not a timestamp: "last done" is remembered to the day, and
    // nobody knows the hour their previous owner changed the oil.
    baselineDate: date('baseline_date'),
    baselineKm: integer('baseline_km'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('vehicle_task_schedules_vehicle_task_type_unique').on(
      table.vehicleId,
      table.taskTypeId,
    ),
    // The unique index above leads with vehicle_id, so it cannot serve the
    // lookup the task type foreign key needs on delete.
    index('vehicle_task_schedules_task_type_idx').on(table.taskTypeId),
    check(
      'vehicle_task_schedules_interval_km_positive',
      sql`${table.intervalKm} is null or ${table.intervalKm} > 0`,
    ),
    check(
      'vehicle_task_schedules_interval_months_positive',
      sql`${table.intervalMonths} is null or ${table.intervalMonths} > 0`,
    ),
    check(
      'vehicle_task_schedules_baseline_km_non_negative',
      sql`${table.baselineKm} is null or ${table.baselineKm} >= 0`,
    ),
  ],
);
