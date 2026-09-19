import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * The local representation of a person.
 *
 * Credentials never live here: authentication is delegated (ADR 0007), and the
 * only link outward is the `sub` claim of the provider's token.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  authSubject: varchar('auth_subject', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
