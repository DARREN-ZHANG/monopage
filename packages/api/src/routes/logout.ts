// packages/api/src/routes/logout.ts

import { jsonResponse } from '../utils/response.js';
import type { Env } from '../types.js';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const response = jsonResponse({
    success: true,
    data: null,
  });

  // 清除 Cookie
  response.headers.set(
    'Set-Cookie',
    'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );

  return response;
}
