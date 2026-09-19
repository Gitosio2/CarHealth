import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are explicit SQL files, reviewable in a pull request before they
 * run anywhere (ADR 0009). `drizzle-kit push` is deliberately not wired to a
 * script: it mutates a database with no artefact to review and no record of
 * what changed.
 *
 * DATABASE_URL is read directly rather than through the env contract in
 * `src/config`: this file is tooling, executed by the CLI outside the Nest
 * process, and the app's boot-time validation has not run.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
