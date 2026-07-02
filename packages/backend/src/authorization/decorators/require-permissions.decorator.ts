import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'requiredPermissions';

export const RequirePermissions = (...codes: string[]): MethodDecorator & ClassDecorator => {
  // Fail loudly at decoration time (module load) rather than silently fail-open at runtime.
  // A zero-arg @RequirePermissions() produces an empty metadata array that the guard cannot
  // distinguish from "no decorator present", which would ship an ungated route in a
  // fail-closed subsystem. Reject it here so the misuse surfaces at boot.
  if (codes.length === 0) {
    throw new Error('@RequirePermissions requires at least one permission code.');
  }
  return SetMetadata(REQUIRE_PERMISSIONS_KEY, codes);
};
