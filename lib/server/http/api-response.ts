import {
  NextResponse,
} from 'next/server';

import {
  AuthenticationError,
} from '../auth/firebase-rest-auth';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function errorResponse(
  error: unknown,
  id: string
) {
  if (
    error instanceof
    AuthenticationError
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message:
            error.message,
          requestId: id,
        },
      },
      {
        status: 401,
        headers: {
          'Cache-Control':
            'no-store',
          'X-Request-Id': id,
        },
      }
    );
  }

  const problem =
    error instanceof ApiError
      ? error
      : new ApiError(
          500,
          'INTERNAL_ERROR',
          'ReportOS could not complete the request.'
        );

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: problem.code,
        message:
          problem.message,
        requestId: id,
      },
    },
    {
      status: problem.status,
      headers: {
        'Cache-Control':
          'no-store',
        'X-Request-Id': id,
      },
    }
  );
}
