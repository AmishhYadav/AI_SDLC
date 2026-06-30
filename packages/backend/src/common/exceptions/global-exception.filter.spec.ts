import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHost(traceId?: string): any {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const getRequest = vi.fn().mockReturnValue({ traceId });
  return { switchToHttp: () => ({ getResponse, getRequest }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeConfig(isProduction = false): any {
  return { isProduction };
}

describe('GlobalExceptionFilter', () => {
  it('returns error envelope for HttpException', () => {
    const filter = new GlobalExceptionFilter(makeConfig());
    const host = makeHost('test-uuid');
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.message).toBe('Not found');
    expect(body.traceId).toBe('test-uuid');
  });

  it('omits stack in production', () => {
    const filter = new GlobalExceptionFilter(makeConfig(true));
    const host = makeHost('x');
    filter.catch(new Error('boom'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body['stack']).toBeUndefined();
  });

  it('includes stack in development', () => {
    const filter = new GlobalExceptionFilter(makeConfig(false));
    const host = makeHost('x');
    filter.catch(new Error('boom'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body['stack']).toBeDefined();
  });

  it('reads traceId from request', () => {
    const filter = new GlobalExceptionFilter(makeConfig());
    const host = makeHost('test-id');
    filter.catch(new Error('any'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.traceId).toBe('test-id');
  });

  it('sets response status to HttpException status', () => {
    const filter = new GlobalExceptionFilter(makeConfig());
    const host = makeHost('x');
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(404);
  });

  it('sets response status to 500 for non-HttpException', () => {
    const filter = new GlobalExceptionFilter(makeConfig());
    const host = makeHost('x');
    filter.catch(new Error('boom'), host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(500);
  });
});
