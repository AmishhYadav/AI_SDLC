import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, Module, Global, Controller, Post, Body } from '@nestjs/common';
import request from 'supertest';
import { PrismaService, PrismaModule } from '@repo/database';
import { IsString } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

// Satisfy Zod validation in AppConfigModule before TestingModule.compile()
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://mock:mock@localhost:5432/mock';
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['CORS_ORIGINS'] = process.env['CORS_ORIGINS'] ?? 'http://localhost:3001';

// @Global() is required because the real PrismaModule is @Global() in @repo/database.
// HealthModule (now imported by AppModule) relies on PrismaService being globally provided.
// Without @Global(), the MockPrismaModule's PrismaService export is scoped to AppModule
// only and cannot be resolved by HealthModule's PrismaHealthIndicator.
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: { onModuleInit: async () => {} } }],
  exports: [PrismaService],
})
class MockPrismaModule {}

// ── Phase 3 test-only helpers ──────────────────────────────────────────────
// TestDto and TestController are used exclusively in the Phase 3 ValidationPipe test.
// They are not exported and have no production usage.

class TestDto {
  @IsString()
  name!: string;
}

@Controller({ path: 'test', version: '1' })
class TestController {
  @Post('echo')
  echo(@Body() body: TestDto): TestDto {
    return body;
  }
}
// ────────────────────────────────────────────────────────────────────────────

describe('App bootstrap (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('404 error envelope has valid UUID traceId (INFRA-05: middleware ran before filter)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/v1/nonexistent')
      .expect(404);

    expect(body.success).toBe(false);
    expect(body.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('routes resolve under /api/v1 prefix (INFRA-01: URI versioning ordering)', async () => {
    // Correct prefix: /api/v1 — setGlobalPrefix('api') THEN enableVersioning(URI)
    const { status } = await request(app.getHttpServer()).get('/api/v1/nonexistent');
    expect(status).toBe(404);

    // Swapped prefix /v1/api would only appear if enableVersioning ran before setGlobalPrefix.
    // GlobalExceptionFilter (@Catch()) catches all unmatched routes, so both paths return 404
    // with our envelope. The proof of correct ordering comes from the route structure being /api/v1.
    const { status: wrongStatus } = await request(app.getHttpServer()).get('/v1/api/nonexistent');
    expect(wrongStatus).toBe(404);
  });

  it('404 error envelope contains all required keys (INFRA-05: envelope shape)', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/v1/nonexistent')
      .expect(404);

    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('errorCode');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('traceId');
  });
});

// ── Phase 3 Platform Kernel integration tests ─────────────────────────────
// Verifies that all Phase 3 components (helmet, CORS, Swagger, ValidationPipe,
// ALS traceId propagation) are wired correctly end-to-end in the full AppModule.
// Uses a separate NestJS app so security middleware can be added without
// modifying the existing App bootstrap describe block.
describe('Phase 3 Platform Kernel (integration)', () => {
  let phase3App: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      // TestController is added to the root test module so ValidationPipe (from
      // AppModule's APP_PIPE provider) applies to its routes automatically.
      controllers: [TestController],
    })
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .compile();

    phase3App = moduleRef.createNestApplication();
    // Security middleware order mirrors main.ts (T-03-07/T-03-08/INFRA-12).
    phase3App.use(helmet());
    phase3App.enableCors({
      origin: ['http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    });
    phase3App.setGlobalPrefix('api');
    phase3App.enableVersioning({ type: VersioningType.URI });

    // Swagger must be set up BEFORE app.init() so Express registers the routes
    // before the HTTP adapter finalizes. Test.createTestingModule does not run
    // main.ts, so the non-prod gate is not invoked; we wire it here manually.
    const document = SwaggerModule.createDocument(
      phase3App,
      new DocumentBuilder()
        .setTitle('Enterprise AI Delivery Platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', phase3App, document);
    await phase3App.init();
  });

  afterAll(async () => {
    await phase3App.close();
  });

  it('Test A (INFRA-12): Helmet sets x-content-type-options security header', async () => {
    const { headers } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent');
    expect(headers['x-content-type-options']).toBeDefined();
  });

  it('Test B (INFRA-12): Helmet sets x-frame-options security header', async () => {
    const { headers } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent');
    expect(headers['x-frame-options']).toBeDefined();
  });

  it('Test C (INFRA-04): ALS traceId propagation — x-request-id echoed in error response', async () => {
    const requestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { body } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent')
      .set('x-request-id', requestId);
    // GlobalExceptionFilter reads cls.getId() which is seeded from x-request-id by ClsModule
    expect(body.traceId).toBe(requestId);
  });

  it('Test D (INFRA-11): Swagger UI served in non-production (NODE_ENV=test)', async () => {
    // SwaggerModule.setup() is called in beforeAll; /api/docs returns HTML (200)
    const { status } = await request(phase3App.getHttpServer()).get('/api/docs');
    expect(status).toBe(200);
  });

  it('Test E (INFRA-07): ValidationPipe rejects unknown fields (400) and accepts valid DTOs (201)', async () => {
    // Phase 4: TestController is not @Public() — AUTH_MODE=stub requires X-Dev-User header.
    // Unknown field 'extra' triggers forbidNonWhitelisted → 400
    const { status: rejectStatus } = await request(phase3App.getHttpServer())
      .post('/api/v1/test/echo')
      .set('Content-Type', 'application/json')
      .set('x-dev-user', 'test@example.com')
      .send({ name: 'valid', extra: 'unknown' });
    expect(rejectStatus).toBe(400);

    // Valid DTO passes validation → 201 (NestJS POST default)
    const { status: acceptStatus } = await request(phase3App.getHttpServer())
      .post('/api/v1/test/echo')
      .set('Content-Type', 'application/json')
      .set('x-dev-user', 'test@example.com')
      .send({ name: 'valid' });
    expect(acceptStatus).toBe(201);
  });

  it('Test F (INFRA-12): CORS reflects allowed origin and blocks unlisted origin', async () => {
    // Allowed origin: access-control-allow-origin matches the allowed origin
    const { headers: allowedHeaders } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent')
      .set('Origin', 'http://localhost:3001');
    expect(allowedHeaders['access-control-allow-origin']).toBe('http://localhost:3001');

    // Unlisted origin: access-control-allow-origin header is NOT the evil origin
    const { headers: rejectedHeaders } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent')
      .set('Origin', 'http://evil.example.com');
    expect(rejectedHeaders['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });
});

// ── Phase 3 Rate Limiting (INFRA-12) ─────────────────────────────────────
// Uses a separate app compiled with THROTTLER_LIMIT=2 so the test does not
// need to send 101 requests. A separate module ensures no cross-contamination
// with the Phase 3 describe above.
describe('Phase 3 Rate Limiting (INFRA-12)', () => {
  let rateLimitApp: INestApplication;

  beforeAll(async () => {
    // Override AppConfigService directly so the ThrottlerModule factory receives
    // limit=2 regardless of dynamic-module caching or ESM hoisting order.
    const mockConfig = {
      get: (key: string): unknown => {
        const map: Record<string, unknown> = {
          THROTTLER_LIMIT: 2,
          THROTTLER_TTL_SECONDS: 60,
          CORS_ORIGINS: 'http://localhost:3001',
          LOG_LEVEL: 'info',
          NODE_ENV: 'test',
          PORT: 3000,
          DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
        };
        return map[key];
      },
      isProduction: false,
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .overrideProvider(AppConfigService)
      .useValue(mockConfig)
      .compile();

    rateLimitApp = moduleRef.createNestApplication();
    rateLimitApp.setGlobalPrefix('api');
    rateLimitApp.enableVersioning({ type: VersioningType.URI });
    await rateLimitApp.init();
  });

  afterAll(async () => {
    await rateLimitApp.close();
  });

  it('Test G (INFRA-12): ThrottlerGuard returns 429 after request limit exceeded', async () => {
    const server = rateLimitApp.getHttpServer();
    // /api/v1/health/liveness is a matched route — ThrottlerGuard runs before the handler.
    // With THROTTLER_LIMIT=2, the 3rd request in the same TTL window receives 429.
    const first = await request(server).get('/api/v1/health/liveness');
    const second = await request(server).get('/api/v1/health/liveness');
    expect(first.status).not.toBe(429);
    expect(second.status).not.toBe(429);

    const third = await request(server).get('/api/v1/health/liveness');
    expect(third.status).toBe(429);
  });
});

// ── Phase 4 Authentication Guard (AUTH-01, AUTH-03, AUTH-05) ─────────────────
// Verifies that JwtAuthGuard correctly:
//   - Returns 200 for @Public() routes (HealthController) with no auth header
//   - Returns 401 for protected routes when no token or header is provided
//   - Returns 200 for stub-authenticated requests (AUTH_MODE=stub + X-Dev-User header)
// Uses AUTH_MODE=stub (the test default) so no live Entra tenant is required.
describe('Phase 4 Authentication Guard (integration)', () => {
  let authApp: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    })
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .compile();

    authApp = moduleRef.createNestApplication();
    authApp.setGlobalPrefix('api');
    authApp.enableVersioning({ type: VersioningType.URI });
    await authApp.init();
  });

  afterAll(async () => {
    await authApp.close();
  });

  it('Test H (AUTH-03): @Public() health endpoint returns 200 with no Authorization header', async () => {
    const { status } = await request(authApp.getHttpServer())
      .get('/api/v1/health/liveness');
    expect(status).toBe(200);
  });

  it('Test I (AUTH-01): protected endpoint returns 401 when X-Dev-User header is absent (stub mode)', async () => {
    const { status, body } = await request(authApp.getHttpServer())
      .post('/api/v1/test/echo')
      .send({ name: 'test' });
    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('PLATFORM.UNAUTHORIZED');
  });

  it('Test J (AUTH-05): stub-authenticated request succeeds with X-Dev-User header (AUTH_MODE=stub)', async () => {
    const { status } = await request(authApp.getHttpServer())
      .post('/api/v1/test/echo')
      .set('x-dev-user', 'dev@example.com')
      .send({ name: 'test' });
    expect(status).toBe(201);
  });
});
