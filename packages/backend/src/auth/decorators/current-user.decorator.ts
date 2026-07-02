import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUser } from '../current-user.type';

export const GetCurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUser | null =>
    ctx.switchToHttp().getRequest<{ user?: CurrentUser }>().user ?? null,
);
