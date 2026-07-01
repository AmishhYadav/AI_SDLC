import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { extractCorrelationId } from './extract-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  // UUID_RE, extractSafeTraceId, extractTraceparentId moved to extract-correlation-id.ts.
  // When ClsModule is registered (app.module.ts Task 2), this middleware will be simplified
  // to req.traceId = cls.getId() since ClsMiddleware runs first and sets the ALS id.
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    req.traceId = extractCorrelationId(req as { headers: Record<string, string | string[] | undefined> });
    next();
  }
}
