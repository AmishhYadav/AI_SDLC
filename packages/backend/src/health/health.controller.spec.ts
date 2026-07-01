import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule, PrismaService } from '@repo/database';
import { HealthModule } from './health.module';

// Satisfy Zod env schema before TestingModule.compile()
process.env['DATABASE_URL'] =
  process.env['DATABASE_URL'] ?? 'postgresql://mock:mock@localhost:5432/mock';
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
process.env['CORS_ORIGINS'] = process.env['CORS_ORIGINS'] ?? 'http://localhost:3001';

describe('HealthController (integration)', () => {
  describe('with healthy DB', () => {
    let app: INestApplication;

    beforeAll(async () => {
      // PrismaModule is @Global() in the real app. Import it here so PrismaService
      // exists in the module graph and overrideProvider() can replace it with the mock.
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [PrismaModule, HealthModule],
      })
        .overrideProvider(PrismaService)
        .useValue({ $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) })
        .compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/health/liveness returns 200 with { status: ok }', async () => {
      const { status, body } = await request(app.getHttpServer()).get(
        '/api/v1/health/liveness',
      );
      expect(status).toBe(200);
      expect(body).toEqual({ status: 'ok' });
    });

    it('GET /api/v1/health/liveness response has no success key (@RawResponse bypasses envelope)', async () => {
      const { body } = await request(app.getHttpServer()).get(
        '/api/v1/health/liveness',
      );
      expect(body.success).toBeUndefined();
    });

    it('GET /api/v1/health/readiness returns 200 when DB is healthy', async () => {
      const { status, body } = await request(app.getHttpServer()).get(
        '/api/v1/health/readiness',
      );
      expect(status).toBe(200);
      expect(body.status).toBe('ok');
    });
  });

  describe('with broken DB', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [PrismaModule, HealthModule],
      })
        .overrideProvider(PrismaService)
        .useValue({
          $queryRaw: vi.fn().mockRejectedValue(new Error('DB connection refused')),
        })
        .compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI });
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/health/readiness returns 503 when DB is down', async () => {
      const { status, body } = await request(app.getHttpServer()).get(
        '/api/v1/health/readiness',
      );
      expect(status).toBe(503);
      expect(body.status).toBe('error');
    });
  });
});
