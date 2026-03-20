import type { Request } from 'express';
import { TokenService } from '../auth/token-service.js';

export function requireUserId(request: Request, tokenService: TokenService): string {
  const rawAuth = request.headers.authorization;
  if (!rawAuth || !rawAuth.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = rawAuth.slice(7);
  const { userId } = tokenService.verifyAccessToken(token);
  return userId;
}
