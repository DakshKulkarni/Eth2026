import { ethers } from 'ethers';
import { config, keyProblem } from '../config.js';
import { ABI, HUMAN_TEXT_KEYS, ISSUER_TEXT_KEYS, PARENT_NAME, PROFILE_TEXT_KEYS } from './constants.js';
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
  displayName?: string;
  human?: string;
}

export interface IssueResult {
  name: string;
  expiresAt: string;
  issueTx: string;
  recordsTx: string;
  profileTx: string | null;
  humanTx: string | null;
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

    const profileTx = deployment.profileRoles ? await writeProfile(resolver, name, input) : null;
    const humanTx = deployment.humanRoles && input.human ? await writeHuman(resolver, name, input.human) : null;

    return {
      ok: true,
      name: `${input.label}.${PARENT_NAME}`,
      expiresAt: new Date(Number(expiry) * 1000).toISOString(),
      issueTx: issuedReceipt.hash,
      recordsTx: writtenReceipt.hash,
      profileTx,
      humanTx,
    };
  } catch (err) {
    return { ok: false, reason: message(err) };
  }
}

// The profile records are best effort: a failure here must never undo a certificate that is already issued.
async function writeProfile(resolver: ethers.Contract, name: string, input: IssueInput): Promise<string | null> {
  try {
    const values: Record<(typeof PROFILE_TEXT_KEYS)[number], string> = {
      alias: input.displayName ?? '',
      description: 'Certified operator of the cnc-01 vertical machining center. Passed the unaided Test run, judged by the 0G AI technician.',
      class: 'Certificate',
    };
    const calls = PROFILE_TEXT_KEYS.filter((key) => values[key].length > 0).map((key) =>
      resolverIface.encodeFunctionData('setText', [name, key, values[key]]),
    );
    const tx = (await resolver.getFunction('multicall')(calls)) as ethers.ContractTransactionResponse;
    const receipt = await tx.wait();
    return receipt && receipt.status === 1 ? receipt.hash : null;
  } catch {
    return null;
  }
}

// Written separately so a missing permission for this key cannot undo the profile records.
async function writeHuman(resolver: ethers.Contract, name: string, value: string): Promise<string | null> {
  try {
    const calls = HUMAN_TEXT_KEYS.map((key) => resolverIface.encodeFunctionData('setText', [name, key, value]));
    const tx = (await resolver.getFunction('multicall')(calls)) as ethers.ContractTransactionResponse;
    const receipt = await tx.wait();
    return receipt && receipt.status === 1 ? receipt.hash : null;
  } catch {
    return null;
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
