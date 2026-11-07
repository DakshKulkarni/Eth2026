import { ethers } from 'ethers';
import { config } from './config.js';
import { loadDeployment } from './ens/deployment.js';
import { checkCredential } from './ens/read.js';
import { downloadBundle } from './episode/storage.js';
import { explorer } from './explorer.js';

// Read-only views of what is on 0G Chain, 0G Storage and ENS, for the dashboard.
// Everything is cached briefly, and a stale answer is served if a node is slow.

const OUTCOMES: Record<number, string> = { 1: 'learn_complete', 2: 'test_pass', 3: 'test_fail', 4: 'abandoned' };
const ZG_CHAIN_ID = 16602;
const SEPOLIA_ID = 11155111;

const providers = new Map<string, ethers.JsonRpcProvider>();
function provider(url: string, chainId: number): ethers.JsonRpcProvider {
  let p = providers.get(url);
  if (!p) {
    const network = ethers.Network.from(chainId);
    p = new ethers.JsonRpcProvider(url, network, { staticNetwork: network });
    providers.set(url, p);
  }
  return p;
}

interface CacheEntry<T> {
  at: number;
  value: T;
}
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const run = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err: unknown) => {
      if (hit) return hit.value;
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

const blockTimes = new Map<string, number>();
async function blockTime(p: ethers.JsonRpcProvider, tag: string, n: number): Promise<string | null> {
  const key = `${tag}:${n}`;
  let t = blockTimes.get(key);
  if (t === undefined) {
    const block = await p.getBlock(n).catch(() => null);
    if (!block) return null;
    t = block.timestamp;
    blockTimes.set(key, t);
  }
  return new Date(t * 1000).toISOString();
}

// ---- 0G Chain: anchored sessions ----

const anchorIface = new ethers.Interface([
  'event SessionAnchored(bytes32 indexed sessionId, bytes32 rootHash, uint8 outcome, address indexed anchoredBy)',
]);

export interface AnchorRow {
  rootHash: string;
  outcome: string;
  txHash: string;
  block: number;
  at: string | null;
  link: string;
}

export function listAnchors(limit = 40): Promise<{ contract: string | null; anchors: AnchorRow[] }> {
  return cached('anchors', 20_000, async () => {
    const contract = config.ZG_REGISTRY_ADDRESS ?? null;
    if (!contract) return { contract, anchors: [] };
    const p = provider(config.ZG_RPC_URL, ZG_CHAIN_ID);
    const latest = await p.getBlockNumber();
    const logs = await p.getLogs({
      address: contract,
      topics: [anchorIface.getEvent('SessionAnchored')!.topicHash],
      fromBlock: Math.max(0, latest - 40_000),
      toBlock: 'latest',
    });
    const rows: AnchorRow[] = [];
    for (const log of logs.slice(-limit).reverse()) {
      const parsed = anchorIface.parseLog(log);
      if (!parsed) continue;
      rows.push({
        rootHash: String(parsed.args.rootHash),
        outcome: OUTCOMES[Number(parsed.args.outcome)] ?? String(parsed.args.outcome),
        txHash: log.transactionHash,
        block: log.blockNumber,
        at: await blockTime(p, 'zg', log.blockNumber),
        link: explorer.chainTx(log.transactionHash),
      });
    }
    return { contract, anchors: rows };
  });
}

// ---- ENS: licences ----

const certIface = new ethers.Interface([
  'event CertificateIssued(string label, address indexed holder, uint64 expiry)',
  'event CertificateRevoked(string label)',
]);
const resolverIface = new ethers.Interface(['function multicall(bytes[] data)', 'function setText(bytes name, string key, string value)']);

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

export function listCertificates(limit = 12): Promise<CertificateRow[]> {
  return cached('certificates', 25_000, async () => {
    const p = provider(config.SEPOLIA_RPC_URL, SEPOLIA_ID);
    const registrar = loadDeployment().registrar;
    const logs = await p.getLogs({
      address: registrar,
      topics: [certIface.getEvent('CertificateIssued')!.topicHash],
      fromBlock: (await p.getBlockNumber()) - 9000,
      toBlock: 'latest',
    });
    const newest = logs.slice(-limit).reverse();
    const rows: CertificateRow[] = [];
    // Three at a time keeps the node happy.
    for (let i = 0; i < newest.length; i += 3) {
      const batch = await Promise.all(
        newest.slice(i, i + 3).map(async (log): Promise<CertificateRow> => {
          const label = String(certIface.parseLog(log)!.args.label);
          const c = await checkCredential(label);
          return {
            label,
            name: c.name,
            valid: c.valid,
            reason: c.reason,
            expiresAt: c.expiresAt,
            holder: c.holder,
            alias: c.alias,
            class: c.class,
            human: c.human,
            evidence: c.evidence,
            verdict: c.verdict,
            issuedAt: c.issuedAt,
            issueTx: log.transactionHash,
            issueLink: explorer.sepoliaTx(log.transactionHash),
          };
        }),
      );
      rows.push(...batch);
    }
    return rows;
  });
}

export interface RecordWrite {
  tx: string;
  link: string;
  records: { key: string; value: string }[];
}

// The key-value records written to one licence, with the transactions that wrote them.
export function certificateDetail(label: string): Promise<{ licence: CertificateRow | null; writes: RecordWrite[]; anchored: boolean }> {
  return cached(`certificate:${label}`, 30_000, async () => {
    const list = await listCertificates(30);
    const licence = list.find((c) => c.label === label) ?? null;
    const p = provider(config.SEPOLIA_RPC_URL, SEPOLIA_ID);
    const resolver = loadDeployment().resolver;
    const logs = await p.getLogs({ address: resolver, fromBlock: (await p.getBlockNumber()) - 9000, toBlock: 'latest' });
    const writes: RecordWrite[] = [];
    for (const hash of [...new Set(logs.map((l) => l.transactionHash))]) {
      const tx = await p.getTransaction(hash);
      if (!tx) continue;
      let top: ethers.TransactionDescription | null = null;
      try {
        top = resolverIface.parseTransaction({ data: tx.data });
      } catch {
        continue;
      }
      if (top?.name !== 'multicall') continue;
      const mine: { key: string; value: string }[] = [];
      for (const data of Array.from(top.args[0] as Iterable<string>)) {
        const call = resolverIface.parseTransaction({ data });
        if (!call) continue;
        const dns = ethers.toUtf8String(call.args.name).replace(/[\x00-\x1f]/g, '.');
        if (dns.includes(`.${label}.smartician.eth`)) mine.push({ key: String(call.args.key), value: String(call.args.value) });
      }
      if (mine.length > 0) writes.push({ tx: hash, link: explorer.sepoliaTx(hash), records: mine });
    }
    const evidence = licence?.evidence?.replace('0g://', '') ?? null;
    const anchors = (await listAnchors(100)).anchors;
    return { licence, writes, anchored: evidence !== null && anchors.some((a) => a.rootHash === evidence) };
  });
}

// ---- 0G Storage: one stored episode ----

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
  procedureId: string | null;
  model: string | null;
  outcome: string | null;
  startedAt: string | null;
  endedAt: string | null;
  headHash: string | null;
  counts: Record<string, number>;
  events: EpisodeEvent[];
}

function summarise(kind: string, data: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'observe') {
    const r = (data.result ?? {}) as Record<string, unknown>;
    return {
      trigger: data.trigger,
      checkpoint: data.checkpointId ?? null,
      mode: data.mode,
      actions: data.actions,
      machine: data.machine,
      verdict: r.verdict,
      line: r.coachingLine,
      requestId: r.requestId,
      model: r.model,
      latencyMs: r.latencyMs,
    };
  }
  if (kind === 'human_verified') return { provider: data.provider, issuer: data.issuer, acr: data.acr, humanHash: String(data.humanHash ?? '').slice(0, 12) };
  if (kind === 'speech') return { words: data.words, latencyMs: data.latencyMs, requestId: data.requestId, model: data.model };
  return data;
}

const episodeCache = new Map<string, EpisodeView>();

export async function episodeView(rootHash: string): Promise<EpisodeView> {
  const key = rootHash.toLowerCase();
  const hit = episodeCache.get(key);
  if (hit) return hit;
  const result = await downloadBundle(rootHash);
  if (!result.ok) {
    return { rootHash, verified: false, reason: result.reason, sessionId: null, procedureId: null, model: null, outcome: null, startedAt: null, endedAt: null, headHash: null, counts: {}, events: [] };
  }
  const b = result.bundle;
  const counts: Record<string, number> = {};
  for (const r of b.records) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  const view: EpisodeView = {
    rootHash,
    verified: true,
    reason: null,
    sessionId: b.sessionId,
    procedureId: b.procedureId,
    model: b.coachModel,
    outcome: b.outcome,
    startedAt: b.startedAt,
    endedAt: b.endedAt,
    headHash: b.headHash,
    counts,
    events: b.records.map((r) => ({ index: r.index, at: r.at, kind: r.kind, hash: r.hash.slice(0, 16), summary: summarise(r.kind, r.data) })),
  };
  episodeCache.set(key, view);
  if (episodeCache.size > 25) episodeCache.delete(episodeCache.keys().next().value as string);
  return view;
}

// ---- Where everything lives ----

export function chainSummary(): Record<string, unknown> {
  const d = loadDeployment();
  return {
    zeroG: {
      chainId: ZG_CHAIN_ID,
      rpc: config.ZG_RPC_URL,
      registry: config.ZG_REGISTRY_ADDRESS ?? null,
      explorer: 'https://chainscan-galileo.0g.ai',
      storageExplorer: 'https://storagescan-galileo.0g.ai',
      indexer: config.ZG_INDEXER_URL,
      router: config.ZG_ROUTER_URL,
      model: config.ZG_COACH_MODEL,
    },
    ens: {
      network: 'sepolia',
      parent: 'smartician.eth',
      resolver: d.resolver,
      userRegistry: d.userRegistry,
      registrar: d.registrar,
      issuer: d.issuer,
      procedureRoot: d.procedureRoot,
      explorer: 'https://sepolia.etherscan.io',
    },
    world: { issuer: config.WORLD_ISSUER },
  };
}
