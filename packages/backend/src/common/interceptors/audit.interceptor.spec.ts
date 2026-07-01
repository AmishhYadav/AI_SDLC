import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { AuditAction } from '@repo/database';
import { AuditInterceptor } from './audit.interceptor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePrisma(shouldThrow = false): any {
  const create = shouldThrow
    ? vi.fn().mockRejectedValue(new Error('DB error'))
    : vi.fn().mockResolvedValue({});
  return { auditLog: { create } };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeProvider(returnsContext = false): any {
  return {
    getContext: vi.fn().mockReturnValue(
      returnsContext ? { organizationId: 'org-1', userId: 'u-1' } : null,
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeReflector(hasAuditMeta = true): any {
  return {
    get: vi.fn().mockReturnValue(
      hasAuditMeta
        ? { action: AuditAction.CREATE, resource: 'User' }
        : undefined,
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1', headers: { 'user-agent': 'test' } }),
    }),
  } as unknown as ExecutionContext;
}

function makeCallHandler(data = 'result'): CallHandler {
  return { handle: () => of(data) };
}

describe('AuditInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test A: skips prisma write when provider returns null context', async () => {
    const prisma = makePrisma();
    const provider = makeProvider(false);
    const reflector = makeReflector(true);
    const interceptor = new AuditInterceptor(reflector, provider, prisma);

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler()),
    );

    expect(result).toBe('result');
    // Wait for any fire-and-forget promises to settle
    await Promise.resolve();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('Test B: calls prisma.auditLog.create with correct data when context has organizationId', async () => {
    const prisma = makePrisma();
    const provider = makeProvider(true);
    const reflector = makeReflector(true);
    const interceptor = new AuditInterceptor(reflector, provider, prisma);

    await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler()),
    );

    // Allow micro-task queue to flush (fire-and-forget promise)
    await Promise.resolve();

    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    const callArg = prisma.auditLog.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(callArg.data['organizationId']).toBe('org-1');
    expect(callArg.data['action']).toBe(AuditAction.CREATE);
    expect(callArg.data['resource']).toBe('User');
  });

  it('Test C: failure of prisma write does not propagate — Observable still emits success', async () => {
    const prisma = makePrisma(true);
    const provider = makeProvider(true);
    const reflector = makeReflector(true);
    const interceptor = new AuditInterceptor(reflector, provider, prisma);

    // Should not throw even though prisma.auditLog.create rejects
    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler('ok')),
    );

    expect(result).toBe('ok');
    // Allow fire-and-forget to settle (it logs the error internally)
    await Promise.resolve();
  });

  it('Test D: passes through without audit when handler has no @Audit() decorator', async () => {
    const prisma = makePrisma();
    const provider = makeProvider(true);
    const reflector = makeReflector(false); // no audit meta
    const interceptor = new AuditInterceptor(reflector, provider, prisma);

    const result = await lastValueFrom(
      interceptor.intercept(makeContext(), makeCallHandler('passthru')),
    );

    expect(result).toBe('passthru');
    await Promise.resolve();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
