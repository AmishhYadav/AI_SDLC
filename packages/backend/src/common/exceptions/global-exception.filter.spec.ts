import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { PLATFORM_ERROR_CODES } from './error-codes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHost(): any {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const getResponse = vi.fn().mockReturnValue({ status });
  const getRequest = vi.fn().mockReturnValue({});
  return { switchToHttp: () => ({ getResponse, getRequest }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCls(id = 'test-trace-id'): any {
  return { getId: vi.fn().mockReturnValue(id) };
}

describe('GlobalExceptionFilter', () => {
  it('returns error envelope for HttpException', () => {
    const filter = new GlobalExceptionFilter(makeCls('test-uuid'));
    const host = makeHost();
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.message).toBe('Not found');
    expect(body.traceId).toBe('test-uuid');
    expect(body.errorCode).toBe(PLATFORM_ERROR_CODES.NOT_FOUND);
  });

  it('maps HTTP status codes to correct error codes', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const cases: [number, string][] = [
      [HttpStatus.NOT_FOUND, PLATFORM_ERROR_CODES.NOT_FOUND],
      [HttpStatus.CONFLICT, PLATFORM_ERROR_CODES.RESOURCE_CONFLICT],
      [HttpStatus.BAD_REQUEST, PLATFORM_ERROR_CODES.VALIDATION_ERROR],
      [HttpStatus.UNPROCESSABLE_ENTITY, PLATFORM_ERROR_CODES.VALIDATION_ERROR],
    ];
    for (const [httpStatus, expectedCode] of cases) {
      const host = makeHost();
      filter.catch(new HttpException('msg', httpStatus), host);
      const response = host.switchToHttp().getResponse();
      const body = response.status.mock.results[0].value.json.mock.calls[0][0];
      expect(body.errorCode).toBe(expectedCode);
    }
  });

  it('maps FORBIDDEN status to PLATFORM.FORBIDDEN (not INTERNAL_ERROR)', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe(PLATFORM_ERROR_CODES.FORBIDDEN);
    expect(body.errorCode).not.toBe(PLATFORM_ERROR_CODES.INTERNAL_ERROR);
  });

  it('surfaces explicit errorCode from HttpException response object', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(
      new HttpException(
        { errorCode: 'AUTHZ.PERMISSION_DENIED', message: 'You do not have permission to perform this action' },
        HttpStatus.FORBIDDEN,
      ),
      host,
    );
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe('AUTHZ.PERMISSION_DENIED');
  });

  it('uses INTERNAL_ERROR for non-HttpExceptions', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(new Error('crash'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.errorCode).toBe(PLATFORM_ERROR_CODES.INTERNAL_ERROR);
  });

  it('joins array message with semicolons', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(
      new HttpException({ message: ['name must be a string', 'email is invalid'] }, HttpStatus.BAD_REQUEST),
      host,
    );
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.message).toBe('name must be a string; email is invalid');
  });

  it('never exposes stack trace in HTTP responses (WR-06: CLAUDE.md §11)', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(new Error('boom'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body['stack']).toBeUndefined();
  });

  it('reads traceId from CLS (not request object)', () => {
    const filter = new GlobalExceptionFilter(makeCls('expected-id'));
    const host = makeHost();
    filter.catch(new Error('any'), host);
    const response = host.switchToHttp().getResponse();
    const body = response.status.mock.results[0].value.json.mock.calls[0][0];
    expect(body.traceId).toBe('expected-id');
  });

  it('sets response status to HttpException status', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(404);
  });

  it('sets response status to 500 for non-HttpException', () => {
    const filter = new GlobalExceptionFilter(makeCls());
    const host = makeHost();
    filter.catch(new Error('boom'), host);
    const response = host.switchToHttp().getResponse();
    expect(response.status.mock.calls[0][0]).toBe(500);
  });
});
