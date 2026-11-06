import { createPublicClient, http, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';
import { config } from '../src/config.js';

const client = createPublicClient({ chain: sepolia, transport: http(config.SEPOLIA_RPC_URL) });
console.log(`viem's built-in Sepolia universal resolver: ${sepolia.contracts.ensUniversalResolver?.address ?? 'none'}\n`);

const name = normalize('cnc-01.smartician.eth');
const candidates: Array<[string, Address | undefined]> = [
  ['viem default', undefined],
  ['UpgradableUniversalResolverProxy', '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'],
  ['UniversalResolverV2', '0x24e1d8e068620b647ca097f961a61055f4f42d72'],
  ['ManagedUniversalResolverProxy', '0x6d80F2172CFdEc5730fE683860C33d26fC42e6F1'],
];

for (const [label, address] of candidates) {
  try {
    const value = await client.getEnsText({ name, key: 'mrt.model', ...(address ? { universalResolverAddress: address } : {}) });
    console.log(`${label.padEnd(36)} -> ${value === null ? 'null (no record found)' : JSON.stringify(value)}`);
  } catch (err) {
    console.log(`${label.padEnd(36)} -> error: ${err instanceof Error ? err.message.split('\n')[0]?.slice(0, 100) : 'unknown'}`);
  }
}
