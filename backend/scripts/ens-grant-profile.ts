import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';
import { ABI, HUMAN_TEXT_KEYS, PROFILE_TEXT_KEYS } from '../src/ens/constants.js';

const problem = keyProblem('OWNER_PRIVATE_KEY') ?? keyProblem('AGENT_PRIVATE_KEY');
if (problem) {
  console.error(problem);
  process.exit(1);
}

const file = new URL('../deployments/sepolia.json', import.meta.url);
if (!existsSync(file)) {
  console.error('deployments/sepolia.json is missing; run ens:setup first');
  process.exit(1);
}
const state = JSON.parse(readFileSync(file, 'utf8')) as { resolver: string; profileRoles?: boolean; humanRoles?: boolean };

const provider = new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL);
const owner = new ethers.Wallet(config.OWNER_PRIVATE_KEY as string, provider);
const agent = new ethers.Wallet(config.AGENT_PRIVATE_KEY as string).address;
const iface = new ethers.Interface(ABI.resolver);
const resolver = new ethers.Contract(state.resolver, ABI.resolver, owner);

for (const key of [...PROFILE_TEXT_KEYS, ...HUMAN_TEXT_KEYS]) {
  const setter = iface.encodeFunctionData('setText', ['0x', key, '']);
  const tx = (await resolver.getFunction('grantSetterRoles')(setter, agent)) as ethers.ContractTransactionResponse;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`grant for ${key} reverted`);
  console.log(`granted ${key}`);
}
state.profileRoles = true;
state.humanRoles = true;
writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
console.log('done: the issuer can now write alias, description, class and mrt.human on certificates');
