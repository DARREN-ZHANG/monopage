import { AppError } from './errors.js';
import type { ArticlesResponse, RefreshResponse } from '../types.js';

export function successResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function articlesResponse(response: ArticlesResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function refreshResponse(response: RefreshResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: AppError): Response {
  const json = error.toJSON();
  return new Response(JSON.stringify(json), {
    status: error.httpStatus || 500,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function validationErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        code_num: 2000,
        message,
        retryable: false,
      },
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
