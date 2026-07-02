import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { PermissionsGuard } from './permissions.guard';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * Authorization infrastructure module — leaf-level, no cyclic DI risk.
 *
 * CRITICAL: imports only AppConfigModule. PrismaModule and ClsModule are
 * registered as @Global() in AppModule, so their providers (PrismaService,
 * ClsService) are available here without explicit import. Domain modules
 * must NOT be imported here to prevent circular dependency errors.
 *
 * PermissionsGuard is also registered globally as APP_GUARD in AppModule
 * (after JwtAuthGuard) — the provider here satisfies NestJS DI for that
 * global registration. D-05: guard chain is ThrottlerGuard → JwtAuthGuard
 * → PermissionsGuard.
 */
@Module({
  imports: [AppConfigModule],
  providers: [PermissionsGuard, PermissionResolverService],
  exports: [PermissionsGuard, PermissionResolverService],
})
export class AuthorizationModule {}
