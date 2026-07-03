import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TenantedPrismaService } from './tenanted-prisma.service';

// ── Mock dependencies ──────────────────────────────────────────────────────
// PrismaService is mocked so we can capture the $allOperations callback
// that gets registered via $extends at construction time.
// ClsService is mocked so we can control what organizationId is returned.

let capturedExtensionFn:
  | ((ctx: {
      model: string;
      operation: string;
      args: Record<string, unknown>;
      query: (args: Record<string, unknown>) => Promise<unknown>;
    }) => Promise<unknown>)
  | null = null;

const mockPrisma = {
  $extends: vi.fn().mockImplementation(
    (ext: {
      query: {
        $allModels: {
          $allOperations: (ctx: {
            model: string;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) => Promise<unknown>;
        };
      };
    }) => {
      capturedExtensionFn = ext.query.$allModels.$allOperations;
      return { organizationMember: { findMany: vi.fn() } };
    },
  ),
};

const mockCls = { get: vi.fn() };

// ── Helper: invoke $allOperations with given args ──────────────────────────
function callAllOperations(
  model: string,
  operation: string,
  where: Record<string, unknown> = {},
) {
  if (!capturedExtensionFn) throw new Error('TenantedPrismaService not instantiated');
  const mockQuery = vi.fn().mockResolvedValue([]);
  const args: { where: Record<string, unknown> } = { where };
  return capturedExtensionFn({ model, operation, args, query: mockQuery }).then(() => ({
    args,
    mockQuery,
  }));
}

describe('TenantedPrismaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedExtensionFn = null;
    // Reconstruct service to reset the captured extension fn
    new TenantedPrismaService(mockPrisma as never, mockCls as never);
  });

  // ── Test 1: Injection ────────────────────────────────────────────────────
  it('injection — scoped model + eligible operation + orgId present → args.where merged with organizationId and deletedAt:null', async () => {
    mockCls.get.mockReturnValue('org-123');

    const { args } = await callAllOperations('organizationMember', 'findMany', {});

    expect(args.where).toMatchObject({
      organizationId: 'org-123',
      deletedAt: null,
    });
  });

  // ── Test 2: Fail-closed ──────────────────────────────────────────────────
  it('fail-closed (D-08) — scoped model + eligible operation + orgId undefined → throws ForbiddenException with NO_ORG_CONTEXT', async () => {
    mockCls.get.mockReturnValue(undefined);

    await expect(callAllOperations('organizationMember', 'findMany')).rejects.toThrow(
      ForbiddenException,
    );

    // Verify the error code is NO_ORG_CONTEXT, not just any ForbiddenException
    try {
      await callAllOperations('organizationMember', 'findMany');
    } catch (err) {
      const forbidden = err as ForbiddenException;
      const response = forbidden.getResponse() as { errorCode: string };
      expect(response.errorCode).toContain('NO_ORG_CONTEXT');
    }
  });

  // ── Test 3: NO_WHERE skip ────────────────────────────────────────────────
  it('NO_WHERE skip — scoped model + create operation → args NOT mutated (create has no where arg)', async () => {
    mockCls.get.mockReturnValue('org-123');

    const { args, mockQuery } = await callAllOperations('organizationMember', 'create', {});

    expect(args.where).toEqual({});
    expect(mockQuery).toHaveBeenCalledTimes(1);
    // organizationId must NOT be injected
    expect(args.where).not.toHaveProperty('organizationId');
  });

  // ── Test 4: UNIQUE skip ──────────────────────────────────────────────────
  it('UNIQUE skip — scoped model + findUnique operation → args NOT mutated (findUnique type safety)', async () => {
    mockCls.get.mockReturnValue('org-123');

    const { args, mockQuery } = await callAllOperations(
      'organizationMember',
      'findUnique',
      { id: 'member-1' },
    );

    expect(mockQuery).toHaveBeenCalledTimes(1);
    // organizationId must NOT be injected — findUnique.where forbids non-unique fields
    expect(args.where).not.toHaveProperty('organizationId');
    expect(args.where).not.toHaveProperty('deletedAt');
  });

  // ── Test 5: Non-scoped model skip ────────────────────────────────────────
  it('non-scoped skip — auditLog model (not in ORG_SCOPED_MODELS) + findMany → args NOT mutated regardless of CLS state', async () => {
    mockCls.get.mockReturnValue('org-123');

    const { args, mockQuery } = await callAllOperations('auditLog', 'findMany', {});

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(args.where).not.toHaveProperty('organizationId');
    expect(args.where).not.toHaveProperty('deletedAt');
  });
});
