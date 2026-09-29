/**
 * The physical schema, assembled in one place.
 *
 * This barrel exists for the two consumers that legitimately need the whole
 * database: drizzle-kit, which generates migrations from it, and the test
 * harness, which migrates a container.
 *
 * A repository must NOT import this file. It imports the schema file of its
 * own bounded context, so that reaching into another context's tables is a
 * visible import rather than an accident — see ADR 0013.
 */
export * from './identity';
export * from './maintenance';
export * from './odometer';
export * from './reminders';
export * from './vehicles';
