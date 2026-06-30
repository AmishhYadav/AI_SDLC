import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@repo/database';
import { PrismaExceptionFilter } from './prisma-exception.filter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHost(traceId = 'uuid'): any {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ traceId }),
    }),
  };
}

describe('PrismaExceptionFilter', () => {
  it('maps P2002 to 409 with PLATFORM.RESOURCE_CONFLICT', () => {
    const filter = new PrismaExceptionFilter();
    const host = makeHost('uuid');
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    filter.catch(err, host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(409);
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe('PLATFORM.RESOURCE_CONFLICT');
    expect(body.success).toBe(false);
    expect(body.traceId).toBe('uuid');
  });

  it('maps P2025 to 404 with PLATFORM.NOT_FOUND', () => {
    const filter = new PrismaExceptionFilter();
    const host = makeHost('uuid');
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });
    filter.catch(err, host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(404);
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe('PLATFORM.NOT_FOUND');
    expect(body.success).toBe(false);
    expect(body.traceId).toBe('uuid');
  });

  it('maps unknown Prisma error code to 500 with PLATFORM.INTERNAL_ERROR', () => {
    const filter = new PrismaExceptionFilter();
    const host = makeHost('uuid');
    const err = new Prisma.PrismaClientKnownRequestError('Unknown error', {
      code: 'P9999',
      clientVersion: '6.0.0',
    });
    filter.catch(err, host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(500);
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe('PLATFORM.INTERNAL_ERROR');
    expect(body.success).toBe(false);
  });

  it('does not include exception.meta in response body', () => {
    const filter = new PrismaExceptionFilter();
    const host = makeHost('uuid');
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['email'], modelName: 'User' },
    });
    filter.catch(err, host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('email');
    expect(bodyStr).not.toContain('User');
    expect(bodyStr).not.toContain('meta');
  });
});
