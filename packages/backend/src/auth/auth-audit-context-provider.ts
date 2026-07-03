import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';

/**
 * D-16 (Phase 6): Reads userId and organizationId from CLS to supply AuditInterceptor.
 *
 * TenantGuard populates 'organizationId' and 'userId' into CLS after validating
 * ACTIVE membership. ClsService is globally available (ClsModule.forRoot in AppModule)
 * so no AuthModule.imports[] change is required.
 *
 * Returns null on @NoTenantScope routes and any request where TenantGuard has not run
 * (e.g. @Public() routes) — AuditInterceptor skips audit log writes on null (existing behavior).
 */
@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) {
    super();
  }

  getContext(): AuditContext | null {
    const organizationId = this.cls.get<string>('organizationId');
    const userId = this.cls.get<string>('userId');
    if (!organizationId) return null;
    return { organizationId, userId };
  }
}
