import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@repo/database';

export const AUDIT_KEY = 'AUDIT';

export interface AuditMeta {
  action: AuditAction;
  resource: string;
}

export const Audit = (action: AuditAction, resource: string): MethodDecorator =>
  SetMetadata(AUDIT_KEY, { action, resource });
