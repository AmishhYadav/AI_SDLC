import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  // ClsMiddleware (mounted via ClsModule.forRoot in app.module.ts) runs first and sets
  // the ALS id via idGenerator (extractCorrelationId). This middleware's sole purpose is
  // to sync req.traceId = cls.getId() for backward compatibility.
  use(req: Request & { traceId?: string }, _res: Response, next: NextFunction): void {
    req.traceId = this.cls.getId();
    next();
  }
}
