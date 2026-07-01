/**
 * Creates a per-domain error code object enforcing PREFIX.CODE dotted UPPER_SNAKE shape.
 * Co-locate the returned object with the domain, not in this file.
 * See PLATFORM_ERROR_CODES in error-codes.ts for the manual equivalent this helper automates.
 *
 * @example
 * export const AUTH_ERROR_CODES = createErrorCatalog('AUTH', ['INVALID_TOKEN', 'EXPIRED_TOKEN'] as const);
 */
export function createErrorCatalog<const T extends string>(
  prefix: string,
  codes: readonly T[],
): { [K in T]: `${string}.${K}` } {
  return Object.fromEntries(codes.map((c) => [c, `${prefix}.${c}`])) as {
    [K in T]: `${string}.${K}`;
  };
}

/** Weak cross-domain type for function signatures that accept any domain error code. */
export type DomainErrorCode = `${string}.${string}`;
