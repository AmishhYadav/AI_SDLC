import { createErrorCatalog } from '../common/error-catalog/create-error-catalog';

export const TENANT_ERROR_CODES = createErrorCatalog('TENANT', [
  'MISSING_ORG_HEADER',
  'ORG_ACCESS_DENIED',
  'NO_ORG_CONTEXT',
  'USER_NOT_FOUND',
  'LAST_MEMBER_REMOVAL',
] as const);
