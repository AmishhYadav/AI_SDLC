/**
 * Authenticated principal resolved from a validated JWT token.
 *
 * D-01: Claims-only shape — no database lookup on every request.
 * D-03: email maps from preferred_username ?? email (v2.0 endpoint only;
 *        NOT upn — that is a v1.0 claim).
 *
 * Field mapping from Entra ID JWT claims:
 *   entraId      ← oid   (immutable object ID; recommended cross-app key)
 *   email        ← preferred_username ?? email
 *   tenantId     ← tid
 *   displayName  ← name  (nullable — requires the profile scope)
 */
export interface CurrentUser {
  entraId: string;
  email: string;
  tenantId: string;
  displayName?: string | null;
}
