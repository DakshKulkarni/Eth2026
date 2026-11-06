import { readFileSync } from 'node:fs';
import { z } from 'zod';

const schema = z.object({
  issuer: z.string(),
  resolver: z.string(),
  userRegistry: z.string(),
  registrar: z.string(),
  procedureRoot: z.string(),
  profileRoles: z.boolean().optional(),
  humanRoles: z.boolean().optional(),
});

export type Deployment = z.infer<typeof schema>;

let cached: Deployment | null = null;

export function loadDeployment(): Deployment {
  if (cached) return cached;
  const file = new URL('../../deployments/sepolia.json', import.meta.url);
  cached = schema.parse(JSON.parse(readFileSync(file, 'utf8')));
  return cached;
}
