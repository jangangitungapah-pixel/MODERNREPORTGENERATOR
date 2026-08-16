import {
  z,
} from 'zod';

export const systemHealthSchema =
  z.object({
    ok: z.literal(true),
    ready: z.boolean(),
    service:
      z.literal('reportos'),
    runtime:
      z.literal(
        'cloudflare-workers'
      ),
    architecture:
      z.literal(
        'full-stack'
      ),
    database: z.object({
      binding: z.enum([
        'ready',
        'standby',
      ]),
      canonicalModel:
        z.literal('ready'),
    }),
    timestamp:
      z.string().datetime(),
    requestId:
      z.string().min(1),
  });

export type SystemHealth =
  z.infer<
    typeof systemHealthSchema
  >;
