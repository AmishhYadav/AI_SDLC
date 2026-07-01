import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'RAW_RESPONSE';

export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);
