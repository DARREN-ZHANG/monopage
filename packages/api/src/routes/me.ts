// packages/api/src/routes/me.ts

import { jsonResponse } from '../utils/response.js';
import { getAuthenticatedUser } from '../middleware/auth.js';
import type { Env } from '../types.js';

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const username = await getAuthenticatedUser(request, env);

  return jsonResponse({
    success: true,
    data: { username },
  });
}
