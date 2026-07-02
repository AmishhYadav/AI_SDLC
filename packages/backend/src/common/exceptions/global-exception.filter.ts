import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { AppConfigService } from '../../config/app-config.service';
import { PLATFORM_ERROR_CODES, PlatformErrorCode } from './error-codes';

// ORDER: status → platform error code. Unmapped statuses fall back to INTERNAL_ERROR.
const HTTP_STATUS_TO_ERROR_CODE: Partial<Record<number, PlatformErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: PLATFORM_ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.NOT_FOUND]: PLATFORM_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: PLATFORM_ERROR_CODES.RESOURCE_CONFLICT,
  [HttpStatus.BAD_REQUEST]: PLATFORM_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.UNPROCESSABLE_ENTITY]: PLATFORM_ERROR_CODES.VALIDATION_ERROR,
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly config: AppConfigService,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttp ? exception.getResponse() : null;
    const rawMessage =
      isHttp && typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse
        ? (rawResponse as Record<string, unknown>)['message']
        : undefined;

    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : isHttp
          ? exception.message
          : 'An unexpected error occurred';

    const errorCode = isHttp
      ? (HTTP_STATUS_TO_ERROR_CODE[status] ?? PLATFORM_ERROR_CODES.INTERNAL_ERROR)
      : PLATFORM_ERROR_CODES.INTERNAL_ERROR;

    const body: Record<string, unknown> = {
      success: false,
      errorCode,
      message,
      traceId: this.cls.getId() ?? crypto.randomUUID(),
    };

    if (!this.config.isProduction && exception instanceof Error) {
      body['stack'] = exception.stack;
    }

    response.status(status).json(body);
  }
}
