import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';
import { ABI, DRILL_GUIDE_LABEL, DRILL_LABEL, PARENT_NAME, SEPOLIA } from '../src/ens/constants.js';
import { loadDeployment } from '../src/ens/deployment.js';
import { nameState } from '../src/ens/read.js';
import { uploadBytes } from '../src/episode/storage.js';

// Registers the drill press machine passport and its guide next to the CNC ones, reusing the existing
// resolver and registry. Safe to run again: names that exist are skipped and records are rewritten.
const problem = keyProblem('OWNER_PRIVATE_KEY');
if (problem) {
  console.error(problem);
  process.exit(1);
}

const deployment = loadDeployment();
const provider = new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL);
const owner = new ethers.Wallet(config.OWNER_PRIVATE_KEY as string, provider);
console.log(`owner wallet: ${owner.address} (${ethers.formatEther(await provider.getBalance(owner.address))} Sepolia ETH)`);

const send = async (tx: Promise<unknown>): Promise<void> => {
  const response = (await tx) as ethers.ContractTransactionResponse;
  const receipt = await response.wait();
  if (!receipt || receipt.status !== 1) throw new Error('transaction reverted');
};

const userRegistry = new ethers.Contract(deployment.userRegistry, ABI.userRegistry, owner);
const resolver = new ethers.Contract(deployment.resolver, ABI.resolver, owner);

console.log('upload the drill press procedure to 0G Storage');
const bytes = readFileSync(new URL('../../procedure/drill-press.json', import.meta.url));
const upload = await uploadBytes(new Uint8Array(bytes));
if (!upload.ok) {
  console.error(`0G upload failed: ${upload.reason}`);
  process.exit(1);
}
console.log(`  root hash ${upload.rootHash}`);

const expiry = BigInt(Math.floor(Date.now() / 1000) + 364 * 24 * 3600);
for (const label of [DRILL_LABEL, DRILL_GUIDE_LABEL]) {
  if ((await nameState(label)).status === 'registered') {
    console.log(`skip  register ${label} (already registered)`);
    continue;
  }
  console.log(`run   register ${label}.${PARENT_NAME}`);
  await send(userRegistry.getFunction('register')(label, owner.address, ethers.ZeroAddress, deployment.resolver, 0n, expiry));
}

const records: Array<[string, string, string]> = [
  [DRILL_LABEL, 'description', 'Benchtop drill press, simulated twin for operator training'],
  [DRILL_LABEL, 'mrt.model', 'drill-press-twin-1'],
  [DRILL_LABEL, 'mrt.procedure', `0g://${upload.rootHash}`],
  [DRILL_LABEL, 'mrt.guide', `${DRILL_GUIDE_LABEL}.${PARENT_NAME}`],
  [DRILL_LABEL, 'mrt.guideVersion', '1.0.0'],
  [DRILL_GUIDE_LABEL, 'agent-context', `AI technician for benchtop drill press set-up and drilling. Judges the trainee on 0G Compute (${config.ZG_COACH_MODEL}); evidence on 0G Storage and 0G Chain.`],
  [DRILL_GUIDE_LABEL, 'mrt.model', config.ZG_COACH_MODEL],
  [DRILL_GUIDE_LABEL, 'mrt.guideVersion', '1.0.0'],
];
for (const [label, key, value] of records) {
  await send(resolver.getFunction('setText')(ethers.dnsEncode(`${label}.${PARENT_NAME}`), key, value));
  console.log(`  ${label}.${PARENT_NAME}  ${key}`);
}
console.log('\nDrill press passport is on ENS:');
console.log(`  machine: ${DRILL_LABEL}.${PARENT_NAME}`);
console.log(`  guide:   ${DRILL_GUIDE_LABEL}.${PARENT_NAME}`);
console.log(`  explorer: https://sepolia.etherscan.io/address/${deployment.resolver}`);
