import { CurrentUser } from './current-user.type';

/**
 * Abstract class used as NestJS DI token (not interface — interfaces are erased at runtime).
 * Implementations: EntraTokenValidator (AUTH_MODE=entra) and StubTokenValidator (AUTH_MODE=stub).
 * Per D-02: never returns roles or permissions — Phase 5 concern.
 *
 * Follows the same abstract-class-as-DI-token pattern as IAuditContextProvider.
 */
export abstract class TokenValidator {
  abstract validate(rawToken: string): Promise<CurrentUser>;
}
