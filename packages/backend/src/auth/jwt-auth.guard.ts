import { Injectable, CanActivate } from '@nestjs/common';

/**
 * Stub guard — Task 1 placeholder so auth.module.ts compiles without the full guard.
 * Task 2 replaces this body with the real CanActivate implementation.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
