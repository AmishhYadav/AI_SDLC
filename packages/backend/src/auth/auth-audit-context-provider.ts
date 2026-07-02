import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { IAuditContextProvider, AuditContext } from '../audit/audit-context-provider.interface';

/**
 * D-04 (Phase 3/4): No organizationId available yet.
 * AuditInterceptor skips audit log writes when getContext() returns null (existing behavior).
 * Phase 6 will supply organizationId and userId via CLS, completing the audit trail.
 *
 * userId is accessible as cls.get('user')?.entraId but is deliberately not returned
 * until Phase 6 provides a non-nullable organizationId for the AuditLog FK constraint.
 */
@Injectable()
export class AuthAuditContextProvider extends IAuditContextProvider {
  constructor(private readonly cls: ClsService) {
    super();
  }

  getContext(): AuditContext | null {
    return null;
  }
}
