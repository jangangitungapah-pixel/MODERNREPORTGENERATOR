import {
  getCloudflareContext,
} from '@opennextjs/cloudflare';

import {
  ApiError,
} from '@/lib/server/http/api-response';

export type D1RunResult = {
  success?: boolean;
  meta?: {
    changes?: number;
  };
};

export type D1Statement = {
  bind: (
    ...values: unknown[]
  ) => D1Statement;
  first: <T = unknown>() =>
    Promise<T | null>;
  all: <T = unknown>() =>
    Promise<{
      results: T[];
    }>;
  run: () =>
    Promise<D1RunResult>;
};

export type ReportOsD1 = {
  prepare: (
    query: string
  ) => D1Statement;
  batch: (
    statements:
      D1Statement[]
  ) => Promise<unknown[]>;
};

type ReportOsEnvironment = {
  DB?: ReportOsD1;
  REPORTOS_ENV?: string;
};

export function reportOsDb(): ReportOsD1 {
  const context =
    getCloudflareContext();

  const env =
    context.env as unknown as
      ReportOsEnvironment;

  if (!env.DB) {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      'ReportOS database binding is not configured.'
    );
  }

  return env.DB;
}
