import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '@repo/database';
import { ClsModule, ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { PrismaExceptionFilter } from './common/exceptions/prisma-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { extractCorrelationId } from './common/middleware/extract-correlation-id';

@Module({
  imports: [
    // ORDER MATTERS: ClsModule must appear before LoggerModule.
    // NestJS applies module middleware in import order. ClsMiddleware must initialize
    // the ALS store before pino-http's genReqId callback executes, otherwise
    // cls.getId() returns undefined and reqId appears as null in all log lines.
    AppConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: { headers: Record<string, string | string[] | undefined> }) =>
          extractCorrelationId(req),
      },
    }),
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      // ClsService is globally available (ClsModule.forRoot global: true); no need to re-import ClsModule here.
      inject: [AppConfigService, ClsService],
      useFactory: (config: AppConfigService, cls: ClsService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          genReqId: () => cls.getId(),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["set-cookie"]',
              'req.body.password',
              'req.body.token',
              'req.body.apiKey',
              'req.body.secret',
            ],
            censor: '[REDACTED]',
          },
          autoLogging: {
            ignore: (req: { url?: string }) => Boolean(req.url?.includes('/health')),
          },
          serializers: {
            req: (req: { method: string; url: string; id: string }) => ({
              method: req.method,
              url: req.url,
              id: req.id,
            }),
          },
        },
      }),
    }),
    PrismaModule,
  ],
  providers: [
    // ORDER MATTERS: NestJS executes APP_FILTERs in reverse registration order,
    // so the last-registered filter has highest priority. GlobalExceptionFilter
    // must come FIRST so that the more-specific PrismaExceptionFilter (registered
    // last = highest priority) wins for Prisma errors. Swapping these lines would
    // cause GlobalExceptionFilter to intercept all Prisma errors before
    // PrismaExceptionFilter runs, silently breaking RESOURCE_CONFLICT / NOT_FOUND codes.
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // ClsMiddleware (mounted via ClsModule.forRoot) runs first and sets the ALS id.
    // CorrelationIdMiddleware then syncs req.traceId = cls.getId() for backward compatibility.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
