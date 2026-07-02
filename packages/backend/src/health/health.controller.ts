import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { RawResponse } from '../common/interceptors/raw-response.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma-health.indicator';

// D-10 (Phase 4): @Public() at class level — liveness and readiness probes bypass
// JwtAuthGuard entirely so Kubernetes health checks never require auth headers.
@Controller({ path: 'health', version: '1' })
@RawResponse()
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.prismaIndicator.isHealthy('prisma')]);
  }
}
