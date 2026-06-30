import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES } from './error-codes';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttp ? exception.getResponse() : null;
    const message =
      isHttp &&
      typeof rawResponse === 'object' &&
      rawResponse !== null &&
      'message' in rawResponse
        ? String((rawResponse as Record<string, unknown>)['message'])
        : isHttp
          ? exception.message
          : 'An unexpected error occurred';

    const body: Record<string, unknown> = {
      success: false,
      errorCode: PLATFORM_ERROR_CODES.INTERNAL_ERROR,
      message,
      traceId: request.traceId ?? 'unknown',
    };

    if (!this.config.isProduction && exception instanceof Error) {
      body['stack'] = exception.stack;
    }

    response.status(status).json(body);
  }
}
