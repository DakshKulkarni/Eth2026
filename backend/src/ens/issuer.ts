import { ethers } from 'ethers';
import { config, keyProblem } from '../config.js';
import { ABI, ISSUER_TEXT_KEYS, PARENT_NAME } from './constants.js';
import { loadDeployment } from './deployment.js';

export type TxResult<T> = ({ ok: true } & T) | { ok: false; reason: string };

const resolverIface = new ethers.Interface([...ABI.resolver, 'function multicall(bytes[] data) returns (bytes[])']);

function wallet(): ethers.Wallet | string {
  const problem = keyProblem('AGENT_PRIVATE_KEY');
  if (problem || !config.AGENT_PRIVATE_KEY) return problem ?? 'AGENT_PRIVATE_KEY is not set';
  return new ethers.Wallet(config.AGENT_PRIVATE_KEY, new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL));
}

function message(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 220) : 'unknown error';
}

export interface IssueInput {
  label: string;
  holder: string;
  validityDays: number;
  evidenceRoot: string;
  outcome: string;
}

export interface IssueResult {
  name: string;
  expiresAt: string;
  issueTx: string;
  recordsTx: string;
}

export async function issueCertificate(input: IssueInput): Promise<TxResult<IssueResult>> {
  const signer = wallet();
  if (typeof signer === 'string') return { ok: false, reason: signer };
  try {
    const deployment = loadDeployment();
    const registrar = new ethers.Contract(deployment.registrar, ABI.registrar, signer);
    const expiry = BigInt(Math.floor(Date.now() / 1000) + input.validityDays * 24 * 3600);
    const issued = (await registrar.getFunction('issue')(input.label, input.holder, expiry)) as ethers.ContractTransactionResponse;
    const issuedReceipt = await issued.wait();
    if (!issuedReceipt || issuedReceipt.status !== 1) return { ok: false, reason: 'issue transaction reverted' };

    const name = ethers.dnsEncode(`${input.label}.${PARENT_NAME}`);
    const values: Record<(typeof ISSUER_TEXT_KEYS)[number], string> = {
      'mrt.evidence': `0g://${input.evidenceRoot}`,
      'mrt.verdict': input.outcome,
      'mrt.issuedAt': new Date().toISOString(),
    };
    const calls = ISSUER_TEXT_KEYS.map((key) => resolverIface.encodeFunctionData('setText', [name, key, values[key]]));
    const resolver = new ethers.Contract(deployment.resolver, resolverIface, signer);
    const written = (await resolver.getFunction('multicall')(calls)) as ethers.ContractTransactionResponse;
    const writtenReceipt = await written.wait();
    if (!writtenReceipt || writtenReceipt.status !== 1) return { ok: false, reason: 'records transaction reverted' };

    return {
      ok: true,
      name: `${input.label}.${PARENT_NAME}`,
      expiresAt: new Date(Number(expiry) * 1000).toISOString(),
      issueTx: issuedReceipt.hash,
      recordsTx: writtenReceipt.hash,
    };
  } catch (err) {
    return { ok: false, reason: message(err) };
  }
}

export async function revokeCertificate(label: string): Promise<TxResult<{ revokeTx: string }>> {
  const signer = wallet();
  if (typeof signer === 'string') return { ok: false, reason: signer };
  try {
    const registrar = new ethers.Contract(loadDeployment().registrar, ABI.registrar, signer);
    const tx = (await registrar.getFunction('revoke')(label)) as ethers.ContractTransactionResponse;
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) return { ok: false, reason: 'revoke transaction reverted' };
    return { ok: true, revokeTx: receipt.hash };
  } catch (err) {
    return { ok: false, reason: message(err) };
  }
}
