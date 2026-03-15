import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { userId: string }>();
    const token = req.headers.authorization?.replace(/^Bearer\s+/, '');

    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      req.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid auth token');
    }
  }
}
