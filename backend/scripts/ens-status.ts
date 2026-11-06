import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';

const label = process.argv[2] ?? 'smartician';
const provider = new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL);

const v2Registry = new ethers.Contract(
  '0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4',
  ['function getState(uint256 anyId) view returns (tuple(uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))'],
  provider,
);
const v1Registry = new ethers.Contract(
  '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
  ['function owner(bytes32 node) view returns (address)', 'function resolver(bytes32 node) view returns (address)'],
  provider,
);

console.log(`name: ${label}.eth on Sepolia\n`);

try {
  const state = (await v2Registry.getFunction('getState')(BigInt(ethers.id(label)))) as { status: bigint; expiry: bigint; latestOwner: string; tokenId: bigint };
  const status = ['AVAILABLE', 'RESERVED', 'REGISTERED'][Number(state.status)] ?? String(state.status);
  const expiry = state.expiry > 0n ? new Date(Number(state.expiry) * 1000).toISOString() : 'none';
  console.log(`ENSv2 registry:  ${status}, owner ${state.latestOwner}, expires ${expiry}`);
} catch (err) {
  console.log(`ENSv2 registry:  call failed (${err instanceof Error ? err.message.slice(0, 80) : 'error'})`);
}

try {
  const node = ethers.namehash(`${label}.eth`);
  const owner = (await v1Registry.getFunction('owner')(node)) as string;
  console.log(`ENSv1 registry:  owner ${owner === ethers.ZeroAddress ? 'none' : owner}`);
} catch (err) {
  console.log(`ENSv1 registry:  call failed (${err instanceof Error ? err.message.slice(0, 80) : 'error'})`);
}

console.log('\nwallets in backend/.env (public addresses only):');
for (const name of ['OWNER_PRIVATE_KEY', 'AGENT_PRIVATE_KEY', 'APPROVER_PRIVATE_KEY'] as const) {
  const problem = keyProblem(name);
  const key = config[name];
  if (problem || !key) {
    console.log(`  ${name.padEnd(22)} ${problem}`);
    continue;
  }
  const address = new ethers.Wallet(key).address;
  const balance = ethers.formatEther(await provider.getBalance(address));
  console.log(`  ${name.padEnd(22)} ${address}  ${balance} Sepolia ETH`);
}
