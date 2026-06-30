import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    const fromHeader =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['traceparent'] as string | undefined);

    req.traceId = fromHeader ?? crypto.randomUUID();
    next();
  }
}
