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
  // What the trainee operates, used in the judge's instructions and on the ENS licence.
  machine: z.object({ name: z.string(), label: z.string() }).default({ name: 'CNC vertical machining center', label: 'cnc-01' }),
  version: z.string(),
  hintLimit: z.number().int(),
  stages: z.array(z.object({ id: z.number().int(), title: z.string() })),
  steps: z.array(stepSchema),
});

export type Step = z.infer<typeof stepSchema>;
export type Procedure = z.infer<typeof procedureSchema>;

export const DEFAULT_PROCEDURE = 'cnc-vmc';
const FILES = ['cnc-vmc', 'drill-press'];

let registry: Map<string, Procedure> | null = null;

function load(): Map<string, Procedure> {
  if (registry) return registry;
  registry = new Map();
  for (const id of FILES) {
    const file = new URL(`../../../procedure/${id}.json`, import.meta.url);
    const procedure = procedureSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    registry.set(procedure.id, procedure);
  }
  return registry;
}

export function getProcedure(id: string | undefined): Procedure | undefined {
  return load().get(id ?? DEFAULT_PROCEDURE);
}

export function listProcedures(): Procedure[] {
  return [...load().values()];
}

// The default procedure, for callers that do not choose one.
export function loadProcedure(): Procedure {
  return getProcedure(DEFAULT_PROCEDURE) as Procedure;
}
