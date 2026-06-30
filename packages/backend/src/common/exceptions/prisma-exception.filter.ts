import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@repo/database';
import { PLATFORM_ERROR_CODES } from './error-codes';

const PRISMA_HTTP_MAP: Record<string, { status: number; errorCode: string; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    errorCode: PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
    message: 'Resource already exists',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    errorCode: PLATFORM_ERROR_CODES.NOT_FOUND,
    message: 'Resource not found',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
@Injectable()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const mapped = PRISMA_HTTP_MAP[exception.code];
    const status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode = mapped?.errorCode ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR;
    const message = mapped?.message ?? 'Database operation failed';

    response.status(status).json({
      success: false,
      errorCode,
      message,
      traceId: request.traceId ?? crypto.randomUUID(),
    });
  }
}
