import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY_META = 'IDEMPOTENCY_KEY';

/**
 * Marks an endpoint as requiring idempotency key handling.
 * D-09: The enforcement interceptor is a future Phase enhancement — contract exists now.
 */
export const IdempotencyKey = (): MethodDecorator => SetMetadata(IDEMPOTENCY_KEY_META, true);
