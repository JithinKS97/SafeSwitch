import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** User object attached by @thallesp/nestjs-better-auth AuthGuard */
type RequestWithUser = Request & { user?: { id: string } };

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return req.user?.id ?? '';
  },
);
