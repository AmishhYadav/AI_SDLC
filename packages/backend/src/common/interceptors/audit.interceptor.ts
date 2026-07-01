import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '@repo/database';
import { IAuditContextProvider } from '../../audit/audit-context-provider.interface';
import { AUDIT_KEY, AuditMeta } from '../../audit/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditContextProvider: IAuditContextProvider,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!auditMeta) return next.handle();

    const req = context
      .switchToHttp()
      .getRequest<{ ip?: string; headers: Record<string, string | undefined> }>();

    return next.handle().pipe(
      tap({ next: () => void this.writeAuditLog(auditMeta, req) }),
    );
  }

  private writeAuditLog(
    meta: AuditMeta,
    req: { ip?: string; headers: Record<string, string | undefined> },
  ): void {
    const ctx = this.auditContextProvider.getContext();
    if (!ctx?.organizationId) return; // D-04: no org context — skip silently

    // Kernel interceptors are permitted to call PrismaService directly per the Phase 2 PrismaExceptionFilter precedent (kernel infrastructure, not domain code).
    this.prisma.auditLog
      .create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: meta.action,
          resource: meta.resource,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      })
      .catch((err: unknown) => this.logger.error(err, 'AuditInterceptor: write failed'));
  }
}
