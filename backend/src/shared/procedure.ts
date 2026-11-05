import { readFileSync } from 'node:fs';
import { z } from 'zod';

const stepSchema = z.object({
  id: z.string(),
  stage: z.number().int(),
  title: z.string(),
  spokenInstruction: z.string(),
  rationale: z.string(),
  targetControl: z.string(),
  expectedAction: z.object({ control: z.string(), action: z.string(), value: z.string() }),
  checkpoint: z.boolean(),
  mode: z.string(),
  forbiddenBefore: z.array(z.string()),
});

export const procedureSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  hintLimit: z.number().int(),
  stages: z.array(z.object({ id: z.number().int(), title: z.string() })),
  steps: z.array(stepSchema),
});

export type Step = z.infer<typeof stepSchema>;
export type Procedure = z.infer<typeof procedureSchema>;

export function loadProcedure(): Procedure {
  const file = new URL('../../../procedure/cnc-vmc.json', import.meta.url);
  return procedureSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
