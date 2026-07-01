import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCls(id = 'test-trace-id'): any {
  return { getId: vi.fn().mockReturnValue(id) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeReflector(isRaw = false): any {
  return { getAllAndOverride: vi.fn().mockReturnValue(isRaw) };
}

function makeContext(handler: object = {}, controllerClass = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
  } as unknown as ExecutionContext;
}

function makeCallHandler(data: unknown): CallHandler {
  return { handle: () => of(data) };
}

describe('ResponseEnvelopeInterceptor', () => {
  it('Test A: wraps plain value in success envelope', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(makeReflector(false), makeCls());

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler({ foo: 'bar' })),
    );

    expect(result).toEqual({
      success: true,
      data: { foo: 'bar' },
      meta: null,
      traceId: 'test-trace-id',
    });
  });

  it('Test B: forwards data and meta for PaginatedResult shape', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(makeReflector(false), makeCls());
    const paginatedData = {
      data: [1, 2],
      meta: { nextCursor: 'abc', hasNextPage: true },
    };

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler(paginatedData)),
    );

    expect(result).toEqual({
      success: true,
      data: [1, 2],
      meta: { nextCursor: 'abc', hasNextPage: true },
      traceId: 'test-trace-id',
    });
  });

  it('Test C: @RawResponse bypass — emits raw handler output unchanged', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(makeReflector(true), makeCls());
    const rawData = { status: 'ok' };

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler(rawData)),
    );

    expect(result).toBe(rawData);
  });

  it('Test D: null handler output wrapped with data: null', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(makeReflector(false), makeCls());

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler(null)),
    );

    expect(result).toEqual({
      success: true,
      data: null,
      meta: null,
      traceId: 'test-trace-id',
    });
  });

  it('Test E: traceId sourced from cls.getId()', async () => {
    const interceptor = new ResponseEnvelopeInterceptor(makeReflector(false), makeCls('custom-id'));

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler({})),
    );

    expect((result as { traceId: string }).traceId).toBe('custom-id');
  });
});
