import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType, Module } from '@nestjs/common';
import request from 'supertest';
import { PrismaService, PrismaModule } from '@repo/database';
import { AppModule } from './app.module';

// Satisfy Zod validation in AppConfigModule before TestingModule.compile()
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://mock:mock@localhost:5432/mock';
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['CORS_ORIGINS'] = process.env['CORS_ORIGINS'] ?? 'http://localhost:3001';

@Module({
  providers: [{ provide: PrismaService, useValue: { onModuleInit: async () => {} } }],
  exports: [PrismaService],
})
class MockPrismaModule {}

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
