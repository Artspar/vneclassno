import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

function signPart(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export class TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  issueTokens(userId: string): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const now = Math.floor(Date.now() / 1000);
    const accessExp = now + 60 * 30;
    const refreshExp = now + 60 * 60 * 24 * 30;

    const accessPayload: TokenPayload = {
      sub: userId,
      type: 'access',
      iat: now,
      exp: accessExp,
    };

    const refreshPayload: TokenPayload = {
      sub: userId,
      type: 'refresh',
      iat: now,
      exp: refreshExp,
    };

    return {
      accessToken: this.encode(accessPayload, this.accessSecret),
      refreshToken: this.encode(refreshPayload, this.refreshSecret),
      expiresIn: 60 * 30,
    };
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = this.decode(token, this.accessSecret);
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return { userId: payload.sub };
  }

  verifyRefreshToken(token: string): { userId: string } {
    const payload = this.decode(token, this.refreshSecret);
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return { userId: payload.sub };
  }

  private encode(payload: TokenPayload, secret: string): string {
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = signPart(encodedPayload, secret);
    return `${encodedPayload}.${signature}`;
  }

  private decode(token: string, secret: string): TokenPayload {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      throw new Error('Malformed token');
    }

    const expected = signPart(encodedPayload, secret);
    const provided = Buffer.from(signature);
    const actual = Buffer.from(expected);

    if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload)) as TokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      throw new Error('Token expired');
    }

    return payload;
  }
}
