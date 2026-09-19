import { sql } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { profiles } from './identity';

/**
 * A vehicle belongs to exactly one profile.
 *
 * `plate` and `vin` are unique **per profile, not globally**. Global
 * uniqueness would let whoever registers a car first block that plate
 * permanently, and cars get sold. The accepted consequence is that the same
 * physical vehicle can exist in two profiles at once — see the domain model
 * for why that trade was taken deliberately.
 */
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    // Always typeable by hand. VIN decoding only covers vehicles sold in the
    // US from 1981, so an assist that fails must never block registration.
    make: varchar('make', { length: 100 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    plate: varchar('plate', { length: 20 }).notNull(),
    vin: varchar('vin', { length: 17 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('vehicles_profile_plate_unique').on(
      table.profileId,
      table.plate,
    ),
    // Partial, because the VIN is optional and plenty of owners do not have it
    // to hand. PostgreSQL treats NULLs as distinct, so a plain unique index
    // would behave the same — the predicate states the rule rather than
    // leaving it to be inferred from NULL semantics.
    uniqueIndex('vehicles_profile_vin_unique')
      .on(table.profileId, table.vin)
      .where(sql`${table.vin} is not null`),
    // No separate index on profile_id: the unique index above starts with it,
    // so "every vehicle of this profile" already uses that one. A second index
    // would cost writes and buy nothing.
  ],
);
