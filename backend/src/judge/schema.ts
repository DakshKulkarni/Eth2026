import { z } from 'zod';

export const observeSchema = z.object({
  trigger: z.enum(['action', 'tick', 'checkpoint']),
  checkpointId: z.string().optional(),
  mode: z.enum(['learn', 'test']),
  machine: z.object({
    door: z.string(),
    estop: z.string(),
    isolator: z.string(),
    power: z.string(),
    mode: z.string(),
    homed: z.object({ x: z.boolean(), y: z.boolean(), z: z.boolean() }),
    clamped: z.boolean(),
    tool: z.string(),
    program: z.string().nullable(),
    feed: z.number(),
    coolant: z.boolean(),
    cycle: z.string(),
  }),
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

export const modelOutputSchema = z.object({
  verdict: z.enum(['ok', 'correct', 'unsafe']),
  mistakes: z
    .array(z.object({ stepId: z.string(), code: z.string(), explanation: z.string() }))
    .max(3)
    .default([]),
  coachingLine: z.string().default(''),
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
}
