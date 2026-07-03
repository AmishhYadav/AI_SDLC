import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { TenantGuard } from './tenant.guard';
import { TenantedPrismaService } from './tenanted-prisma.service';
import { TenantContextService } from './tenant-context.service';

/**
 * Tenancy infrastructure module — leaf-level, no cyclic DI risk.
 *
 * CRITICAL: imports only AppConfigModule. PrismaModule and ClsModule are
 * registered as @Global() in AppModule, so their providers (PrismaService,
 * ClsService) are available here without explicit import. Domain modules
 * must NOT be imported here to prevent circular dependency errors.
 *
 * TenantGuard is also registered globally as APP_GUARD in AppModule
 * (after PermissionsGuard) — the provider here satisfies NestJS DI for
 * that global registration. D-04: guard chain is ThrottlerGuard →
 * JwtAuthGuard → PermissionsGuard → TenantGuard.
 */
@Module({
  imports: [AppConfigModule],
  providers: [TenantGuard, TenantedPrismaService, TenantContextService],
  exports: [TenantGuard, TenantedPrismaService, TenantContextService],
})
export class TenancyModule {}
