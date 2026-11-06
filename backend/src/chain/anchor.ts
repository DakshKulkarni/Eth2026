import { ethers } from 'ethers';
import { config, keyProblem } from '../config.js';
import type { Outcome } from '../episode/bundle.js';

const iface = new ethers.Interface([
  'function anchor(bytes32 sessionId, bytes32 rootHash, uint8 outcome)',
  'function anchors(bytes32 sessionId) view returns (bytes32 rootHash, uint8 outcome, uint64 at)',
]);

export const OUTCOME_CODES: Record<Outcome, number> = {
  learn_complete: 1,
  test_pass: 2,
  test_fail: 3,
  abandoned: 4,
};

export type AnchorResult = { ok: true; txHash: string } | { ok: false; reason: string };

export function sessionKey(sessionId: string): string {
  return ethers.id(sessionId);
}

export async function anchorSession(sessionId: string, rootHash: string, outcome: Outcome): Promise<AnchorResult> {
  const problem = keyProblem();
  if (problem || !config.AGENT_PRIVATE_KEY) return { ok: false, reason: problem ?? 'AGENT_PRIVATE_KEY is not set' };
  if (!config.ZG_REGISTRY_ADDRESS) return { ok: false, reason: 'ZG_REGISTRY_ADDRESS is not set' };
  try {
    const wallet = new ethers.Wallet(config.AGENT_PRIVATE_KEY, new ethers.JsonRpcProvider(config.ZG_RPC_URL));
    const data = iface.encodeFunctionData('anchor', [sessionKey(sessionId), rootHash, OUTCOME_CODES[outcome]]);
    const tx = await wallet.sendTransaction({ to: config.ZG_REGISTRY_ADDRESS, data });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) return { ok: false, reason: 'anchor transaction reverted' };
    return { ok: true, txHash: receipt.hash };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown error' };
  }
}

export interface StoredAnchor {
  rootHash: string;
  outcome: number;
  at: number;
}

export async function readAnchor(sessionId: string): Promise<StoredAnchor | null> {
  if (!config.ZG_REGISTRY_ADDRESS) return null;
  const provider = new ethers.JsonRpcProvider(config.ZG_RPC_URL);
  const raw = await provider.call({
    to: config.ZG_REGISTRY_ADDRESS,
    data: iface.encodeFunctionData('anchors', [sessionKey(sessionId)]),
  });
  const [rootHash, outcome, at] = iface.decodeFunctionResult('anchors', raw);
  if (Number(at) === 0) return null;
  return { rootHash: String(rootHash), outcome: Number(outcome), at: Number(at) };
}
