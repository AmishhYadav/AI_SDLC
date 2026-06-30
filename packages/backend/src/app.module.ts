import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '@repo/database';
import { AppConfigModule } from './config/config.module';
import { GlobalExceptionFilter } from './common/exceptions/global-exception.filter';
import { PrismaExceptionFilter } from './common/exceptions/prisma-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [AppConfigModule, PrismaModule],
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
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
