import { z } from "zod";

/** Response of `GET /api/health`. */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
