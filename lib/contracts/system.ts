import {
  z,
} from 'zod';

export const systemHealthSchema =
  z.object({
    ok: z.literal(true),
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
    databasePhase:
      z.literal(
        'foundation'
      ),
    timestamp:
      z.string().datetime(),
    requestId:
      z.string().min(1),
  });

export type SystemHealth =
  z.infer<
    typeof systemHealthSchema
  >;
