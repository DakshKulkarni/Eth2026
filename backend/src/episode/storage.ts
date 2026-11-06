import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import { config, keyProblem } from '../config.js';
import { verifyBundle, type BundleCheck, type EpisodeBundle } from './bundle.js';

export type UploadResult =
  | { ok: true; rootHash: string; txHash: string; txSeq: number }
  | { ok: false; reason: string };

function message(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
}

export async function uploadBundle(bundle: EpisodeBundle): Promise<UploadResult> {
  const problem = keyProblem();
  if (problem || !config.AGENT_PRIVATE_KEY) return { ok: false, reason: problem ?? 'AGENT_PRIVATE_KEY is not set' };
  try {
    const signer = new ethers.Wallet(config.AGENT_PRIVATE_KEY, new ethers.JsonRpcProvider(config.ZG_RPC_URL));
    const indexer = new Indexer(config.ZG_INDEXER_URL);
    const file = new MemData(new TextEncoder().encode(JSON.stringify(bundle)));
    const [, treeError] = await file.merkleTree();
    if (treeError) return { ok: false, reason: `merkle tree: ${message(treeError)}` };

    const sdkSigner = signer as unknown as Parameters<Indexer['upload']>[2];
    const [result, uploadError] = await indexer.upload(file, config.ZG_RPC_URL, sdkSigner);
    if (uploadError) return { ok: false, reason: `upload: ${message(uploadError)}` };
    if (!('rootHash' in result)) return { ok: false, reason: 'bundle was split into fragments' };
    return { ok: true, rootHash: result.rootHash, txHash: result.txHash, txSeq: result.txSeq };
  } catch (err) {
    return { ok: false, reason: message(err) };
  }
}

export async function downloadBundle(rootHash: string): Promise<BundleCheck> {
  try {
    const indexer = new Indexer(config.ZG_INDEXER_URL);
    const [blob, error] = await indexer.downloadToBlob(rootHash, { proof: true });
    if (error) return { ok: false, reason: `download: ${message(error)}` };
    return verifyBundle(JSON.parse(await blob.text()));
  } catch (err) {
    return { ok: false, reason: message(err) };
  }
}
