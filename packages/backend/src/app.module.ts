import { Module, NestModule, MiddlewareConsumer, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@repo/database';
import { ClsModule, ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { PrismaExceptionFilter } from './common/exceptions/prisma-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { extractCorrelationId } from './common/middleware/extract-correlation-id';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { IAuditContextProvider } from './audit/audit-context-provider.interface';
import { IdempotencyStore } from './idempotency/idempotency-store.interface';
import { NoOpIdempotencyStore } from './idempotency/noop-idempotency-store';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuthAuditContextProvider } from './auth/auth-audit-context-provider';

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
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // CRITICAL: @nestjs/throttler v6 TTL is in milliseconds.
        // Use seconds() helper — config stores THROTTLER_TTL_SECONDS in seconds.
        // { ttl: 60, limit: 100 } would mean a 60ms window (not 60s).
        throttlers: [
          {
            ttl: seconds(config.get('THROTTLER_TTL_SECONDS')),
            limit: config.get('THROTTLER_LIMIT'),
          },
        ],
      }),
    }),
    HealthModule,
    AuthModule,
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

    // Global validation pipe: whitelist strips unknown fields, forbidNonWhitelisted returns 400
    // if unknown fields are present (mass-assignment protection, INFRA-07 / D-07).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // Global rate-limit guard (INFRA-12 / D-15). Default: THROTTLER_LIMIT req per
    // THROTTLER_TTL_SECONDS window per IP. Overridable per-route via @Throttle().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // D-09 (Phase 4): JwtAuthGuard is second — ThrottlerGuard runs first to rate-limit all
    // requests including unauthenticated attempts before auth processing begins.
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // INTERCEPTOR REGISTRATION ORDER: APP_INTERCEPTOR response-side execution is LIFO
    // (last-registered runs first on response path). ResponseEnvelopeInterceptor is
    // registered FIRST so it runs LAST (outermost wrapper). AuditInterceptor is registered
    // SECOND so it runs FIRST on the response path (sees raw handler output before envelope
    // wrapping). Do NOT swap these lines.
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    // Audit context provider — Phase 4 returns userId via CLS; audit writes still skip
    // until Phase 6 provides organizationId (D-04).
    { provide: IAuditContextProvider, useClass: AuthAuditContextProvider },

    // Idempotency store — in-memory no-op until Redis lands (D-09).
    { provide: IdempotencyStore, useClass: NoOpIdempotencyStore },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // ClsMiddleware (mounted via ClsModule.forRoot) runs first and sets the ALS id.
    // CorrelationIdMiddleware then syncs req.traceId = cls.getId() for backward compatibility.
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
