import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap(): Promise<void> {
  // bufferLogs: true ensures all NestJS bootstrap logs are flushed through pino
  // after app.useLogger(app.get(Logger)) is called (Pitfall 5: bootstrap logging).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  // 1. Security headers — must be first Express middleware (T-03-07 / INFRA-12).
  app.use(helmet());

  // 2. CORS allowlist — after helmet (T-03-08 / D-15).
  //    CORS_ORIGINS is a required, comma-separated env var (Zod schema, D-16).
  app.enableCors({
    origin: config.get('CORS_ORIGINS').split(',').map((s: string) => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // 3. Global prefix + versioning (unchanged from Phase 2).
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // 4. Swagger — non-prod only (D-14 / INFRA-11, T-03-11).
  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Enterprise AI Delivery Platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  // 5. Graceful shutdown hooks — triggers PrismaService.onModuleDestroy (INFRA-13 / T-03-12).
  //    Do NOT add a second prisma.$disconnect here — the lifecycle hook handles it.
  app.enableShutdownHooks();

  // 6. Replace NestJS default logger with pino — called after bufferLogs so buffered
  //    bootstrap logs are flushed through pino.
  app.useLogger(app.get(Logger));

  await app.listen(config.get('PORT'));
}

bootstrap().catch(() => {
  // Fatal error before pino is ready — process.exit is the last resort.
  process.exit(1);
});
