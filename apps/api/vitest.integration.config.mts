import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests, kept in a separate config from the unit suite.
 *
 * They need Docker (Testcontainers, ADR 0009) and take seconds rather than
 * milliseconds. Mixing them into `pnpm test` would make the fast feedback loop
 * slow enough that people stop running it, which costs more than it buys.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.int-spec.ts'],
    environment: 'node',
    // Starting a container and running the migrations is the slow part, and it
    // happens once per file.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
