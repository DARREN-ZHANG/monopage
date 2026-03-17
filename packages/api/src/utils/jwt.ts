// packages/api/src/utils/jwt.ts

import jwt from '@tsndr/cloudflare-worker-jwt';

interface JWTPayload {
  username: string;
  iat: number;
  exp: number;
}

const JWT_EXPIRY_DAYS = 7;

export async function signToken(username: string, secret: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + JWT_EXPIRY_DAYS * 24 * 60 * 60; // 7 days in seconds

  return jwt.sign(
    { username, iat, exp },
    secret
  );
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const valid = await jwt.verify(token, secret);
    if (!valid) {
      return null;
    }
    const payload = jwt.decode(token);
    return payload?.payload as JWTPayload | null;
  } catch {
    return null;
  }
}
