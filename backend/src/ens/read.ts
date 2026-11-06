import { createPublicClient, http, keccak256, parseAbi, toHex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';
import { config } from '../config.js';
import { GUIDE_LABEL, MACHINE_LABEL, PARENT_NAME } from './constants.js';
import { loadDeployment } from './deployment.js';

const client = createPublicClient({ chain: sepolia, transport: http(config.SEPOLIA_RPC_URL) });

const registryAbi = parseAbi([
  'function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))',
]);

const STATUS = ['available', 'reserved', 'registered'] as const;

export const LABEL_PATTERN = /^[a-z0-9-]{3,40}$/;

export const fullName = (label: string): string => `${label}.${PARENT_NAME}`;

export async function readText(label: string, key: string): Promise<string | null> {
  return client.getEnsText({ name: normalize(fullName(label)), key });
}

async function readTexts(label: string, keys: readonly string[]): Promise<Record<string, string | null>> {
  const values = await Promise.all(keys.map((k) => readText(label, k)));
  return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? null]));
}

export interface NameState {
  status: (typeof STATUS)[number];
  expiresAt: string | null;
  holder: string | null;
}

export async function nameState(label: string): Promise<NameState> {
  const state = await client.readContract({
    address: loadDeployment().userRegistry as Address,
    abi: registryAbi,
    functionName: 'getState',
    args: [BigInt(keccak256(toHex(label)))],
  });
  const status = STATUS[state.status] ?? 'available';
  return {
    status,
    expiresAt: state.expiry > 0n ? new Date(Number(state.expiry) * 1000).toISOString() : null,
    holder: status === 'registered' ? state.latestOwner : null,
  };
}

const passportCache = new Map<string, { at: number; value: Record<string, unknown> }>();
const PASSPORT_FRESH_MS = 5 * 60 * 1000;

export async function getPassport(label: string): Promise<Record<string, unknown>> {
  const cached = passportCache.get(label);
  if (cached && Date.now() - cached.at < PASSPORT_FRESH_MS) return cached.value;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const value = await readPassport(label);
      passportCache.set(label, { at: Date.now(), value });
      return value;
    } catch (err) {
      lastError = err;
    }
  }
  if (cached) return cached.value;
  throw lastError;
}

async function readPassport(label: string): Promise<Record<string, unknown>> {
  const [state, records] = await Promise.all([
    nameState(label),
    readTexts(label, ['description', 'mrt.model', 'mrt.procedure', 'mrt.guide', 'mrt.guideVersion']),
  ]);
  return {
    name: fullName(label),
    registered: state.status === 'registered',
    owner: state.holder,
    expiresAt: state.expiresAt,
    model: records['mrt.model'],
    procedure: records['mrt.procedure'],
    procedureRootHash: records['mrt.procedure']?.replace('0g://', '') ?? null,
    guide: records['mrt.guide'],
    guideVersion: records['mrt.guideVersion'],
    description: records['description'],
    readFrom: 'ENSv2 on Sepolia, read live through the Universal Resolver',
  };
}

export interface CredentialCheck {
  name: string;
  valid: boolean;
  reason: 'valid' | 'expired' | 'revoked_or_unknown' | 'reserved';
  expiresAt: string | null;
  holder: string | null;
  evidence: string | null;
  verdict: string | null;
  issuedAt: string | null;
  approval: string | null;
}

export async function checkCredential(label: string): Promise<CredentialCheck> {
  const state = await nameState(label);
  const expired = state.expiresAt !== null && new Date(state.expiresAt).getTime() <= Date.now();
  const reason: CredentialCheck['reason'] =
    state.status === 'available' ? 'revoked_or_unknown' : state.status === 'reserved' ? 'reserved' : expired ? 'expired' : 'valid';
  const records =
    reason === 'valid' ? await readTexts(label, ['mrt.evidence', 'mrt.verdict', 'mrt.issuedAt', 'mrt.approval']) : {};
  return {
    name: fullName(label),
    valid: reason === 'valid',
    reason,
    expiresAt: state.expiresAt,
    holder: state.holder,
    evidence: records['mrt.evidence'] ?? null,
    verdict: records['mrt.verdict'] ?? null,
    issuedAt: records['mrt.issuedAt'] ?? null,
    approval: records['mrt.approval'] ?? null,
  };
}

export const KNOWN_LABELS = { machine: MACHINE_LABEL, guide: GUIDE_LABEL };
