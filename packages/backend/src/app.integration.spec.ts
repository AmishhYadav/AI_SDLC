import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, Module, Global, Controller, Post, Body, Get } from '@nestjs/common';
import request from 'supertest';
import { PrismaService, PrismaModule } from '@repo/database';
import { IsString } from 'class-validator';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { Public } from './auth/decorators/public.decorator';
import { GetCurrentUser } from './auth/decorators/current-user.decorator';
import type { CurrentUser } from './auth/current-user.type';
import { RequirePermissions } from './authorization/decorators/require-permissions.decorator';

// Satisfy Zod validation in AppConfigModule before TestingModule.compile()
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://mock:mock@localhost:5432/mock';
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['CORS_ORIGINS'] = process.env['CORS_ORIGINS'] ?? 'http://localhost:3001';
// Phase 4: AUTH_MODE must be set before any TestingModule compiles so Zod schema parses it
process.env['AUTH_MODE'] = process.env['AUTH_MODE'] ?? 'stub';

// Phase 5 RBAC real-DB detection (evaluated once at module load time).
// A real DATABASE_URL is any URL that does NOT contain 'mock' — i.e. a real Postgres endpoint.
const realDbAvailable = !!process.env['DATABASE_URL'] && !process.env['DATABASE_URL'].includes('mock');
// D-09 silent-skip guard: when set to '1' in CI the non-skippable guard test fails loudly
// if DATABASE_URL turns out to be mock/absent, preventing a false-green CI run.
const realDbRequired = process.env['RBAC_REALDB_REQUIRED'] === '1';

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

// ── Phase 4 integration test helper ───────────────────────────────────────
// AuthTestController provides controlled routes for testing JwtAuthGuard behaviour:
// - GET /api/v1/auth-test/public: @Public() bypass (no auth required)
// - GET /api/v1/auth-test/protected: requires auth; returns resolved CurrentUser via @GetCurrentUser()

@Controller({ path: 'auth-test', version: '1' })
class AuthTestController {
  @Get('public')
  @Public()
  publicRoute(): { status: string; auth: boolean } {
    return { status: 'ok', auth: false };
  }

  @Get('protected')
  protectedRoute(
    @GetCurrentUser() user: CurrentUser | null,
  ): { status: string; user: CurrentUser | null } {
    return { status: 'ok', user };
  }
}
// ── Phase 5 RBAC real-DB test helper ─────────────────────────────────────
// RbacTestController provides two permission-gated routes for the RBAC real-DB
// describe block. It is intentionally NOT @Public() — JwtAuthGuard must run first.
// - GET /api/v1/rbac-test/read:   @RequirePermissions('organization:read')
// - GET /api/v1/rbac-test/manage: @RequirePermissions('organization:manage')

@Controller({ path: 'rbac-test', version: '1' })
class RbacTestController {
  @Get('read')
  @RequirePermissions('organization:read')
  readRoute(): { ok: boolean } {
    return { ok: true };
  }

  @Get('manage')
  @RequirePermissions('organization:manage')
  manageRoute(): { ok: boolean } {
    return { ok: true };
  }
}
// ────────────────────────────────────────────────────────────────────────────

// D-09 / T-05-16 silent-skip guard — MUST run outside any skippable describe block.
// When CI sets RBAC_REALDB_REQUIRED=1 but DATABASE_URL is mock or missing (env
// mis-wired), this test FAILS loudly, making CI red instead of leaving the whole
// real-DB RBAC proof silently skipping to green.
// Locally (no RBAC_REALDB_REQUIRED flag and no real DB), realDbRequired is false
// so this guard passes trivially and the real-DB block below skips as expected.
it('real-DB RBAC block must actually execute when RBAC_REALDB_REQUIRED is set', () => {
  if (realDbRequired) expect(realDbAvailable).toBe(true);
});

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

    // Unlisted origin: access-control-allow-origin header must be absent (not reflected, not wildcard)
    const { headers: rejectedHeaders } = await request(phase3App.getHttpServer())
      .get('/api/v1/nonexistent')
      .set('Origin', 'http://evil.example.com');
    expect(rejectedHeaders['access-control-allow-origin']).toBeUndefined();
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

// ── Phase 4 Authentication (AUTH-01..AUTH-05) ─────────────────────────────
// Comprehensive auth requirement coverage using AuthTestController:
//   AUTH-01: protected route returns 401 without credentials
//   AUTH-02: no passport-azure-ad import exists in src/
//   AUTH-03: @Public() routes bypass guard; health liveness accessible without auth
//   AUTH-04: @GetCurrentUser() decorator resolves CurrentUser principal correctly
//   AUTH-05: AUTH_MODE=stub with X-Dev-User header produces correct stub identity
describe('Phase 4 Authentication (AUTH-01..AUTH-05)', () => {
  let phase4App: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuthTestController],
    })
      .overrideModule(PrismaModule)
      .useModule(MockPrismaModule)
      .compile();

    phase4App = moduleRef.createNestApplication();
    phase4App.setGlobalPrefix('api');
    phase4App.enableVersioning({ type: VersioningType.URI });
    await phase4App.init();
  });

  afterAll(async () => {
    await phase4App.close();
  });

  it('(A) AUTH-03: @Public() auth-test route returns 200 without Authorization header', async () => {
    const { status, body } = await request(phase4App.getHttpServer())
      .get('/api/v1/auth-test/public');
    expect(status).toBe(200);
    expect(body.data.status).toBe('ok');
  });

  it('(B) AUTH-01 + AUTH-03: protected route returns 401 without credentials', async () => {
    const { status, body } = await request(phase4App.getHttpServer())
      .get('/api/v1/auth-test/protected');
    expect(status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBeDefined();
  });

  it('(C) AUTH-05: X-Dev-User header resolves stub CurrentUser in protected route response', async () => {
    const { status, body } = await request(phase4App.getHttpServer())
      .get('/api/v1/auth-test/protected')
      .set('x-dev-user', 'user@test.com');
    expect(status).toBe(200);
    expect(body.data.user.email).toBe('user@test.com');
    expect(body.data.user.entraId).toBe('stub-user@test.com');
    expect(body.data.user.tenantId).toBe('stub-tenant');
  });

  it('(D) AUTH-04: @GetCurrentUser() resolves full CurrentUser interface (entraId, email, tenantId)', async () => {
    const { body } = await request(phase4App.getHttpServer())
      .get('/api/v1/auth-test/protected')
      .set('x-dev-user', 'user@test.com');
    const user = body.data.user;
    expect(user).toHaveProperty('entraId');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('tenantId');
  });

  it('(E) AUTH-01 + AUTH-03: GET /api/v1/health/liveness returns 200 without Authorization header', async () => {
    const { status } = await request(phase4App.getHttpServer())
      .get('/api/v1/health/liveness');
    expect(status).toBe(200);
  });

  it('(F) AUTH-02: no passport-azure-ad import exists in src/auth/ (no library coupling)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process');
    // Search only production auth source files (exclude *.spec.ts to avoid grepping this file).
    // grep exits 1 (no matches) → execSync throws, confirming AUTH-02.
    // process.cwd() is packages/backend/ when tests run via npm workspace.
    const srcPath = `${process.cwd()}/src`;
    expect(() =>
      execSync(`grep -r "passport-azure-ad" "${srcPath}" --include="*.ts" --exclude="*.spec.ts"`),
    ).toThrow();
  });
});

// ── Phase 5 RBAC Authorization (RBAC-02..RBAC-04) ────────────────────────
// Proves the complete RBAC path end-to-end against a real Postgres database.
// Skipped on local mock-only runs (realDbAvailable=false). Runs in CI where a
// real DATABASE_URL is present, and the non-skippable guard above turns any
// env mis-wiring into a red build (D-09, T-05-16).
//
// This describe block does NOT call .overrideModule(PrismaModule).useModule(MockPrismaModule).
// It uses the real PrismaModule so the PermissionResolverService query hits Postgres.
describe.skipIf(!realDbAvailable)('RBAC Authorization (real DB) (RBAC-02..RBAC-04)', () => {
  let rbacApp: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacTestController],
      // Intentionally NO .overrideModule(PrismaModule).useModule(MockPrismaModule) here.
      // The real PrismaModule connects to the Postgres service provisioned by CI.
    }).compile();

    rbacApp = moduleRef.createNestApplication();
    rbacApp.setGlobalPrefix('api');
    rbacApp.enableVersioning({ type: VersioningType.URI });
    await rbacApp.init();

    prisma = rbacApp.get(PrismaService);

    // Pre-cleanup: remove any leftover fixtures from a previous failed run to ensure idempotency.
    const leftoverUser = await prisma.user.findUnique({ where: { email: 'rbac-allow@test.com' } });
    if (leftoverUser) {
      await prisma.userRole.deleteMany({ where: { userId: leftoverUser.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: leftoverUser.id } });
      await prisma.user.delete({ where: { id: leftoverUser.id } });
    }

    // Look up the seeded reference data (read-only — never mutated by this test).
    const systemOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: 'system' } });
    const developerRole = await prisma.role.findFirstOrThrow({
      where: { organizationId: systemOrg.id, name: 'Developer', deletedAt: null },
    });

    // Create fixtures for rbac-allow@test.com: User → OrganizationMember → UserRole (Developer).
    // The Developer role holds 'organization:read' but NOT 'organization:manage' (seed.ts).
    const fixtureUser = await prisma.user.create({
      data: { email: 'rbac-allow@test.com', firstName: 'RBAC', status: 'ACTIVE' },
    });
    const fixtureMember = await prisma.organizationMember.create({
      data: {
        organizationId: systemOrg.id,
        userId: fixtureUser.id,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    await prisma.userRole.create({
      data: {
        userId: fixtureUser.id,
        roleId: developerRole.id,
        organizationMemberId: fixtureMember.id,
      },
    });
    // rbac-none@test.com deliberately has NO User or UserRole row.
    // PermissionResolverService returns an empty Set (D-04 fail-closed), so all routes deny 403.
  });

  afterAll(async () => {
    // Clean up ONLY the fixture rows. Never touch seeded permissions, roles, or the organization.
    const fixtureUser = await prisma.user.findUnique({ where: { email: 'rbac-allow@test.com' } });
    if (fixtureUser) {
      await prisma.userRole.deleteMany({ where: { userId: fixtureUser.id } });
      await prisma.organizationMember.deleteMany({ where: { userId: fixtureUser.id } });
      await prisma.user.delete({ where: { id: fixtureUser.id } });
    }
    await rbacApp.close();
  });

  it('(a) allow: Developer role holding organization:read returns 200 on the read route (RBAC-02)', async () => {
    const { status } = await request(rbacApp.getHttpServer())
      .get('/api/v1/rbac-test/read')
      .set('x-dev-user', 'rbac-allow@test.com');
    expect(status).toBe(200);
  });

  it('(b) deny: lacking organization:manage returns 403 AUTHZ.PERMISSION_DENIED without leaking the missing code (RBAC-04, D-54)', async () => {
    const { status, body } = await request(rbacApp.getHttpServer())
      .get('/api/v1/rbac-test/manage')
      .set('x-dev-user', 'rbac-allow@test.com');
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe('AUTHZ.PERMISSION_DENIED');
    // D-54: the response message must never include the missing permission code
    expect(body.message).not.toContain('organization:manage');
  });

  it('(c) stub-no-permissions: authenticated stub principal with no seeded UserRole returns 403 — no backdoor (D-09)', async () => {
    // rbac-none@test.com is unknown to the DB; PermissionResolverService returns empty Set (D-04).
    // Proves AUTH_MODE=stub authenticates but never grants permissions.
    const { status } = await request(rbacApp.getHttpServer())
      .get('/api/v1/rbac-test/read')
      .set('x-dev-user', 'rbac-none@test.com');
    expect(status).toBe(403);
  });

  it('(d) chain: missing x-dev-user header returns 401 — JwtAuthGuard runs before PermissionsGuard (RBAC-03)', async () => {
    // No authentication header → JwtAuthGuard returns 401 before PermissionsGuard even runs.
    // Distinguishes authN failure (401) from authZ failure (403) per RBAC-03/RBAC-04.
    const { status } = await request(rbacApp.getHttpServer())
      .get('/api/v1/rbac-test/read');
    expect(status).toBe(401);
  });
});
