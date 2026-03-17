import { AppError } from './errors.js';
import type { ArticlesResponse, RefreshResponse } from '../types.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function jsonHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  };
}

export function jsonResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export function successResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export function articlesResponse(response: ArticlesResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export function refreshResponse(response: RefreshResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: jsonHeaders(),
  });
}

export function errorResponse(error: AppError): Response {
  const json = error.toJSON();
  return new Response(JSON.stringify(json), {
    status: error.httpStatus || 500,
    headers: jsonHeaders(),
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
      headers: jsonHeaders(),
    }
  );
}

export function notFoundResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'NOT_FOUND',
        code_num: 4040,
        message: 'Not Found',
        retryable: false,
      },
    }),
    {
      status: 404,
      headers: jsonHeaders(),
    }
  );
}
