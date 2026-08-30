import { z } from 'zod';

/**
 * Environment contract, validated once at boot.
 *
 * The point is failing fast and loudly. An unvalidated `process.env` lets a
 * missing variable surface later as `undefined` deep inside a request, where
 * the stack trace points at the symptom rather than the cause.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // process.env values are always strings; coerce before validating.
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  // Report every invalid variable at once. Reporting only the first turns
  // fixing a misconfigured environment into a guessing game.
  const details = result.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}
