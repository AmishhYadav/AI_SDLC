import { describe, it, expect } from 'vitest';
import { RequirePermissions } from './require-permissions.decorator';

describe('RequirePermissions decorator', () => {
  // ── WR-04: fail loudly on an empty code list ─────────────────────────────
  it('throws at decoration time when called with no permission codes (fail-closed, not fail-open)', () => {
    expect(() => RequirePermissions()).toThrow(
      '@RequirePermissions requires at least one permission code.',
    );
  });

  it('throws when spread from an empty array (@RequirePermissions(...[]))', () => {
    const codes: string[] = [];
    expect(() => RequirePermissions(...codes)).toThrow(
      '@RequirePermissions requires at least one permission code.',
    );
  });

  // ── Happy path: a non-empty code list returns a usable decorator ──────────
  it('returns a decorator without throwing when at least one code is supplied', () => {
    let decorator: unknown;
    expect(() => {
      decorator = RequirePermissions('projects.read', 'projects.write');
    }).not.toThrow();
    expect(typeof decorator).toBe('function');
  });
});
