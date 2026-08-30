import { Module } from '@nestjs/common';

import { HealthModule } from './health/health.module';

/**
 * Composition root.
 *
 * This is where bounded contexts are wired together. It is the only place
 * allowed to know about all of them; the contexts themselves do not know
 * about each other except through published application ports.
 *
 * See docs/architecture/module-boundaries.md
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
