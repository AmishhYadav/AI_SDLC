import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';

/**
 * D-04 (Phase 3/4): No organizationId available yet.
 * AuditInterceptor skips audit log writes when getContext() returns null (existing behavior).
 * Phase 6 will inject ClsService here to supply userId and organizationId (D-04).
 */
@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  getContext(): AuditContext | null {
    return null;
  }
}
