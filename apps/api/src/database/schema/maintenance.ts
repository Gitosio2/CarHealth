import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { profiles } from './identity';
import { vehicles } from './vehicles';

export const performedByEnum = pgEnum('maintenance_performed_by', [
  'self',
  'workshop',
]);

/**
 * Created on the fly by typing a name — there is no management screen. It
 * exists so history can be grouped by workshop without asking the user for
 * extra work.
 */
export const workshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Typing the same name twice must resolve to the same workshop, or
    // grouping by workshop stops meaning anything.
    uniqueIndex('workshops_profile_name_unique').on(table.profileId, table.name),
  ],
);

/**
 * The task catalog — the load-bearing decision of the whole model.
 *
 * Free text would produce "cambio de aceite", "cambio aceite" and "Cambio de
 * Aceite" as three unmatchable values, and no reminder can be derived from
 * text that cannot be matched.
 *
 * `profileId` is null for the shared catalog everybody sees and set for a task
 * a user added. One table, one behaviour, and user-created tasks carry their
 * own intervals like any other.
 */
export const taskTypes = pgTable(
  'task_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id').references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 120 }).notNull(),
    intervalKm: integer('interval_km'),
    intervalMonths: integer('interval_months'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('task_types_profile_name_unique').on(
      table.profileId,
      table.name,
    ),
    // The index above cannot constrain the shared catalog: PostgreSQL treats
    // NULLs as distinct, so every shared row would be unique from every other.
    // This second, partial index is what actually keeps the catalog clean.
    uniqueIndex('task_types_shared_name_unique')
      .on(table.name)
      .where(sql`${table.profileId} is null`),
    check(
      'task_types_interval_km_positive',
      sql`${table.intervalKm} is null or ${table.intervalKm} > 0`,
    ),
    check(
      'task_types_interval_months_positive',
      sql`${table.intervalMonths} is null or ${table.intervalMonths} > 0`,
    ),
  ],
);

/**
 * A maintenance is a **visit**: one event, at one point in time and mileage.
 * It contains the work performed, and the work consumes parts.
 */
export const maintenances = pgTable(
  'maintenances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    performedBy: performedByEnum('performed_by').notNull(),
    // SET NULL, not CASCADE: deleting the workshop record must not delete the
    // visit. The work happened; that is a fact about the past.
    workshopId: uuid('workshop_id').references(() => workshops.id, {
      onDelete: 'set null',
    }),
    // numeric, never a float. Money in binary floating point is how 320.45
    // becomes 320.44999999999999.
    totalCost: numeric('total_cost', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Only one direction is enforced. Work done by the owner cannot belong to
    // a workshop. The reverse is left open on purpose: "I took it to a garage
    // and do not remember which" is a real answer, and rejecting it would push
    // people to record nothing at all.
    check(
      'maintenances_workshop_only_when_workshop_performed',
      sql`${table.performedBy} = 'workshop' or ${table.workshopId} is null`,
    ),
    check(
      'maintenances_total_cost_non_negative',
      sql`${table.totalCost} is null or ${table.totalCost} >= 0`,
    ),
    index('maintenances_vehicle_performed_at_idx').on(
      table.vehicleId,
      table.performedAt.desc(),
    ),
    // Deleting a workshop sets this column to null, which is a lookup by it.
    index('maintenances_workshop_idx').on(table.workshopId),
  ],
);

/**
 * The work performed. Deleting a task type that history refers to is refused,
 * because it would erase what the work actually was.
 *
 * The foreign key is DEFERRABLE INITIALLY DEFERRED, and that is load-bearing.
 * Deleting a profile cascades down two paths that meet here: profile ->
 * task_types (its private tasks) and profile -> vehicles -> maintenances ->
 * tasks. PostgreSQL runs the first cascade and checks this key before the
 * second has removed the tasks, so any immediate check — RESTRICT or plain
 * NO ACTION — rejects the whole account deletion. Deferred, the check runs at
 * commit, after every cascade: a direct delete of a used task type is still
 * refused, and deleting a profile succeeds.
 *
 * Drizzle cannot express deferrable foreign keys, so the clause is added by
 * hand in the migration SQL. drizzle-kit does not know about it: if a future
 * migration drops and recreates this key, it must be re-added by hand. The
 * integration test "deletes a profile whose private task type its own history
 * uses" goes red if it is lost.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    maintenanceId: uuid('maintenance_id')
      .notNull()
      .references(() => maintenances.id, { onDelete: 'cascade' }),
    taskTypeId: uuid('task_type_id')
      .notNull()
      .references(() => taskTypes.id, { onDelete: 'no action' }),
    notes: text('notes'),
  },
  (table) => [
    index('tasks_maintenance_idx').on(table.maintenanceId),
    // Reminders derive "last time this task was done" by task type across a
    // vehicle's history. Without this index that is a sequential scan.
    index('tasks_task_type_idx').on(table.taskTypeId),
  ],
);

/**
 * Parts hang off the **task**, not the maintenance, so the oil filter is tied
 * to *oil filter change* and the person can see which reference they fitted
 * last time.
 */
export const parts = pgTable(
  'parts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    partNumber: varchar('part_number', { length: 80 }),
    // Fractional on purpose: oil is bought by the litre, and 4.5 L is a
    // quantity an integer column cannot record.
    quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }),
  },
  (table) => [
    check('parts_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'parts_unit_price_non_negative',
      sql`${table.unitPrice} is null or ${table.unitPrice} >= 0`,
    ),
    index('parts_task_idx').on(table.taskId),
  ],
);
