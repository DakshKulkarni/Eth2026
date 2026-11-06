import { z } from 'zod';
import { verifyChain, type EpisodeRecord } from './chain.js';

export const OUTCOMES = ['learn_complete', 'test_pass', 'test_fail', 'abandoned'] as const;
export type Outcome = (typeof OUTCOMES)[number];

const recordSchema = z.object({
  index: z.number().int(),
  at: z.string(),
  kind: z.string(),
  data: z.record(z.unknown()),
  prevHash: z.string(),
  hash: z.string(),
});

export const bundleSchema = z.object({
  version: z.literal(1),
  sessionId: z.string(),
  procedureId: z.string(),
  procedureVersion: z.string(),
  coachModel: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  outcome: z.enum(OUTCOMES),
  headHash: z.string(),
  records: z.array(recordSchema),
});

export type EpisodeBundle = z.infer<typeof bundleSchema>;

export interface BundleInput {
  sessionId: string;
  procedureId: string;
  procedureVersion: string;
  coachModel: string;
  startedAt: string;
  outcome: Outcome;
  records: EpisodeRecord[];
  headHash: string;
}

export function buildBundle(input: BundleInput): EpisodeBundle {
  return { version: 1, endedAt: new Date().toISOString(), ...input };
}

export type BundleCheck = { ok: true; bundle: EpisodeBundle } | { ok: false; reason: string };

export function verifyBundle(raw: unknown): BundleCheck {
  const parsed = bundleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'bundle does not match the expected shape' };
  const chain = verifyChain(parsed.data.records);
  if (!chain.ok) return { ok: false, reason: `chain broken at record ${chain.brokenAt}: ${chain.reason}` };
  const last = parsed.data.records[parsed.data.records.length - 1];
  if (!last || last.hash !== parsed.data.headHash) return { ok: false, reason: 'headHash does not match the last record' };
  return { ok: true, bundle: parsed.data };
}
