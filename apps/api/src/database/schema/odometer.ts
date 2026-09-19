import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { maintenances } from './maintenance';
import { vehicles } from './vehicles';

/**
 * Odometer readings belong to the `vehicles` context, but they live in their
 * own file rather than in `vehicles.ts`.
 *
 * The reason is purely physical: a reading may point at the maintenance that
 * produced it, and a maintenance points at its vehicle. Declaring both foreign
 * keys inside `vehicles.ts` and `maintenance.ts` would make those two files
 * import each other. The cycle is in the file graph, not in the model, so it
 * is broken where it appears — by giving the table that closes it a file of
 * its own, downstream of both.
 */
export const odometerSourceEnum = pgEnum('odometer_source', [
  'manual',
  'maintenance',
]);

/**
 * Current mileage is not a field on `Vehicle`; it is the most recent reading.
 * Earlier readings stay as history, which is what makes it possible to
 * estimate usage and project when a distance-based service falls due.
 */
export const odometerReadings = pgTable(
  'odometer_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    kilometers: integer('kilometers').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    source: odometerSourceEnum('source').notNull(),
    maintenanceId: uuid('maintenance_id').references(() => maintenances.id, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    // There is deliberately NO constraint forcing readings to increase. A
    // decrease is usually a typo, sometimes a replaced cluster or an import,
    // and always the person's call. The application warns; the database does
    // not refuse.
    check(
      'odometer_readings_kilometers_non_negative',
      sql`${table.kilometers} >= 0`,
    ),
    // The link is biconditional, unlike the workshop one: a reading with
    // source 'maintenance' exists *because* a maintenance created it, so
    // neither half can be true alone.
    check(
      'odometer_readings_maintenance_link',
      sql`(${table.source} = 'maintenance') = (${table.maintenanceId} is not null)`,
    ),
    // A visit happens at one mileage, so it produces one reading.
    uniqueIndex('odometer_readings_maintenance_unique').on(table.maintenanceId),
    index('odometer_readings_vehicle_recorded_at_idx').on(
      table.vehicleId,
      table.recordedAt.desc(),
    ),
  ],
);
