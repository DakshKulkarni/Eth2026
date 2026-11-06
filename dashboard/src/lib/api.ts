export type Track = '0g' | 'ens' | 'world' | 'system';

export interface LiveEvent {
  id: number;
  at: string;
  track: Track;
  event: string;
  data: Record<string, unknown>;
}

export interface Overview {
  version: string;
  uptimeSeconds: number;
  model: string;
  world: string | null;
  registry: string | null;
  events: { total: number; byTrack: Record<Track, number> };
  judge: { verdicts: number; safeStops: number; corrections: number; medianMs: number | null; p95Ms: number | null };
}

export interface AnchorRow {
  rootHash: string;
  outcome: string;
  txHash: string;
  block: number;
  at: string | null;
  link: string;
}

export interface CertificateRow {
  label: string;
  name: string;
  valid: boolean;
  reason: string;
  expiresAt: string | null;
  holder: string | null;
  alias: string | null;
  class: string | null;
  human: string | null;
  evidence: string | null;
  verdict: string | null;
  issuedAt: string | null;
  issueTx: string;
  issueLink: string;
}

export interface EpisodeEvent {
  index: number;
  at: string;
  kind: string;
  hash: string;
  summary: Record<string, unknown>;
}

export interface EpisodeView {
  rootHash: string;
  verified: boolean;
  reason: string | null;
  sessionId: string | null;
  model: string | null;
  outcome: string | null;
  startedAt: string | null;
  endedAt: string | null;
  headHash: string | null;
  counts: Record<string, number>;
  events: EpisodeEvent[];
}

export interface ProcedureStep {
  id: string;
  stage: number;
  title: string;
  checkpoint: boolean;
  expectedAction: { control: string; action: string; value: string };
}

export interface Procedure {
  id: string;
  name: string;
  version: string;
  hintLimit: number;
  stages: { id: number; title: string }[];
  steps: ProcedureStep[];
}

export interface ChainSummary {
  zeroG: { chainId: number; registry: string | null; explorer: string; storageExplorer: string; model: string; router: string };
  ens: { network: string; parent: string; resolver: string; userRegistry: string; registrar: string; issuer: string; explorer: string };
  world: { issuer: string };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  overview: () => get<Overview>('/api/overview'),
  anchors: () => get<{ contract: string | null; anchors: AnchorRow[] }>('/api/anchors'),
  certificates: () => get<{ certificates: CertificateRow[] }>('/api/certificates'),
  chain: () => get<ChainSummary>('/api/chain'),
  procedure: () => get<Procedure>('/api/procedure'),
  episode: (root: string) => get<EpisodeView>(`/api/episode/${root}`),
};

export function chainTxLink(hash: string): string {
  return `https://chainscan-galileo.0g.ai/tx/${hash}`;
}
export function sepoliaTxLink(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}
