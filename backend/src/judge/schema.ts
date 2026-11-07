import { z } from 'zod';

export const observeSchema = z.object({
  trigger: z.enum(['action', 'tick', 'checkpoint']),
  checkpointId: z.string().optional(),
  mode: z.enum(['learn', 'test']),
  // Each machine reports its own controls, so the shape is left open and the judge reads it as JSON.
  machine: z.record(z.string(), z.unknown()),
  actions: z
    .array(
      z.object({
        seq: z.number().int(),
        t: z.number(),
        control: z.string(),
        action: z.string(),
        value: z.string(),
      }),
    )
    .max(60),
  frame: z
    .string()
    .regex(/^data:image\/(jpeg|png);base64,/)
    .max(3_000_000)
    .optional(),
});

export type Observe = z.infer<typeof observeSchema>;
export type Action = Observe['actions'][number];

export const modelOutputSchema = z
  .object({
    verdict: z.enum(['ok', 'correct', 'unsafe']),
    mistakes: z
      .array(z.object({ stepId: z.string(), code: z.string(), explanation: z.string() }))
      .max(3)
      .default([]),
    coachingLine: z.string().default(''),
  })
  .refine((v) => v.verdict === 'ok' || (v.mistakes.length > 0 && v.coachingLine.trim().length > 0), {
    message: 'correct or unsafe needs at least one mistake and a coaching line',
  });

export interface Mistake {
  stepId: string;
  code: string;
  explanation: string;
}

export interface CoachResult {
  verdict: 'ok' | 'correct' | 'unsafe' | 'safe_stop';
  completedSteps: string[];
  mistakes: Mistake[];
  coachingLine: string;
  speak: boolean;
  requestId: string;
  model: string;
  latencyMs: number;
  failure?: string;
}
