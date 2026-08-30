import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Liveness only: it answers "is this process serving requests?".
   *
   * It deliberately does not check the database or the auth provider. A
   * liveness probe that fails on a dependency outage makes the platform
   * restart a process that is working, which turns a partial outage into a
   * total one. Readiness checks, when they exist, belong on a separate route.
   */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
