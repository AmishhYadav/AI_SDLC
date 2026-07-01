import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RAW_RESPONSE_KEY } from './raw-response.decorator';
import { PaginatedResult } from '../pagination/pagination-meta.interface';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) return next.handle();

    return next.handle().pipe(
      map((data) => {
        const isPaginated =
          data !== null &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data;

        return {
          success: true as const,
          data: isPaginated ? (data as PaginatedResult<unknown>).data : (data ?? null),
          meta: isPaginated ? (data as PaginatedResult<unknown>).meta : null,
          traceId: this.cls.getId(),
        };
      }),
    );
  }
}
