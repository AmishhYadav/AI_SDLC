import { createErrorCatalog } from '../common/error-catalog/create-error-catalog';

export const AUTHZ_ERROR_CODES = createErrorCatalog('AUTHZ', ['PERMISSION_DENIED'] as const);
