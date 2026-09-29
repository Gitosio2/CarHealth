import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import * as schema from '../../src/database/schema';

export type TestDatabase = NodePgDatabase<typeof schema>;

export interface TestPostgres {
  db: TestDatabase;
  stop: () => Promise<void>;
}

/**
 * A real PostgreSQL, migrated with the real migration files.
 *
 * Running the migrations rather than pushing the schema is deliberate: it is
 * the migration SQL that will execute in production, so it is the migration
 * SQL the tests have to exercise. A `push` would test a schema that no
 * environment ever gets.
 *
 * SQLite and in-memory substitutes are prohibited by ADR 0009 — they accept
 * SQL PostgreSQL rejects and reject SQL it accepts, which is false confidence.
 */
export async function startTestPostgres(): Promise<TestPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();

  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  await migrate(db, { migrationsFolder: 'drizzle' });

  return {
    db,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
