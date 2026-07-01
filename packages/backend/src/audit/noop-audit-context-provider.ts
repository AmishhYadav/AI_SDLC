import { Injectable } from '@nestjs/common';
import { IAuditContextProvider, AuditContext } from './audit-context-provider.interface';

/**
 * D-01: No-op provider. Phase 4 (authenticated principal) and Phase 6 (tenant context) replace
 * this via AuditModule-level provider override with no interceptor changes required.
 */
@Injectable()
export class NoOpAuditContextProvider extends IAuditContextProvider {
  getContext(): AuditContext | null {
    return null;
  }
}
