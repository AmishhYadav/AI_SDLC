export interface AuditContext {
  organizationId: string;
  userId?: string;
}

/**
 * Abstract class used as NestJS DI token (not interface — interfaces are erased at runtime).
 * Implement this class to supply the audit context (organization + user) to AuditInterceptor.
 * D-01: No-op provider is active this phase; Phase 4/6 replaces it via module-level override.
 */
export abstract class IAuditContextProvider {
  abstract getContext(): AuditContext | null;
}
