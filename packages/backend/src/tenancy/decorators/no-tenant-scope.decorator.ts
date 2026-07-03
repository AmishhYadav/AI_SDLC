import { SetMetadata } from '@nestjs/common';

export const IS_NO_TENANT_SCOPE_KEY = 'isNoTenantScope';

export const NoTenantScope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_NO_TENANT_SCOPE_KEY, true);
