import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';
import {
  ABI,
  ALL_ROLES,
  GUIDE_LABEL,
  ISSUER_TEXT_KEYS,
  MACHINE_LABEL,
  PARENT_LABEL,
  PARENT_NAME,
  ROLE_REGISTRAR,
  ROLE_UNREGISTER,
  SEPOLIA,
} from '../src/ens/constants.js';
import { uploadBytes } from '../src/episode/storage.js';
import { compileContract } from './solc-compile.js';

interface Deployment {
  resolver?: string;
  userRegistry?: string;
  linked?: boolean;
  registrar?: string;
  rolesGranted?: boolean;
  setterRoles?: boolean;
  procedureRoot?: string;
  names?: string[];
  recordsSet?: boolean;
  issuer?: string;
}

const deploymentUrl = new URL('../deployments/sepolia.json', import.meta.url);
const state: Deployment = existsSync(deploymentUrl) ? (JSON.parse(readFileSync(deploymentUrl, 'utf8')) as Deployment) : {};
const save = (): void => {
  mkdirSync(new URL('../deployments/', import.meta.url), { recursive: true });
  writeFileSync(deploymentUrl, `${JSON.stringify(state, null, 2)}\n`);
};

for (const name of ['OWNER_PRIVATE_KEY', 'AGENT_PRIVATE_KEY'] as const) {
  const problem = keyProblem(name);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}

const provider = new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL);
const owner = new ethers.Wallet(config.OWNER_PRIVATE_KEY as string, provider);
const agentAddress = new ethers.Wallet(config.AGENT_PRIVATE_KEY as string).address;
const coder = ethers.AbiCoder.defaultAbiCoder();
const saltVersion = BigInt(process.env.ENS_SALT_VERSION ?? '0');

const send = async (tx: Promise<unknown>): Promise<ethers.ContractTransactionReceipt> => {
  const response = (await tx) as ethers.ContractTransactionResponse;
  const receipt = await response.wait();
  if (!receipt || receipt.status !== 1) throw new Error('transaction reverted');
  return receipt;
};

const salt = (tag: string, subject: string, type: 'address' | 'bytes32'): bigint =>
  BigInt(ethers.keccak256(coder.encode(['bytes32', type, 'uint256'], [ethers.keccak256(ethers.toUtf8Bytes(tag)), subject, saltVersion])));

async function deployProxy(implementation: string, proxySalt: bigint, data: string): Promise<string> {
  const factory = new ethers.Contract(SEPOLIA.verifiableFactory, ABI.factory, owner);
  const receipt = await send(factory.getFunction('deployProxy')(implementation, proxySalt, data));
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed?.name === 'ProxyDeployed') return String(parsed.args.proxyAddress);
    } catch {
      continue;
    }
  }
  throw new Error('ProxyDeployed event not found in the receipt');
}

const step = async (title: string, done: boolean, run: () => Promise<void>): Promise<void> => {
  if (done) {
    console.log(`skip  ${title} (already done)`);
    return;
  }
  console.log(`run   ${title}`);
  await run();
  save();
};

const registry = new ethers.Contract(SEPOLIA.ethRegistry, [...ABI.ethRegistry, ...ABI.userRegistry], owner);
const parent = (await registry.getFunction('getState')(BigInt(ethers.id(PARENT_LABEL)))) as { status: bigint; latestOwner: string };
const balance = await provider.getBalance(owner.address);
console.log(`owner wallet: ${owner.address} (${ethers.formatEther(balance)} Sepolia ETH)`);
console.log(`issuer (agent) wallet: ${agentAddress}`);
if (Number(parent.status) !== 2 || parent.latestOwner.toLowerCase() !== owner.address.toLowerCase()) {
  console.error(`${PARENT_NAME} is not owned by the OWNER wallet (owner on chain: ${parent.latestOwner}). Use the key for that account.`);
  process.exit(1);
}
if (balance === 0n) {
  console.error('The OWNER wallet has no Sepolia ETH.');
  process.exit(1);
}
state.issuer = agentAddress;

await step('deploy the resolver proxy', Boolean(state.resolver), async () => {
  const resolverIface = new ethers.Interface(ABI.resolver);
  const data = resolverIface.encodeFunctionData('initialize', [[{ account: owner.address, roleBitmap: ALL_ROLES }], []]);
  state.resolver = await deployProxy(SEPOLIA.permissionedResolverImpl, salt('OwnedResolver', owner.address, 'address'), data);
});

await step('deploy the subname registry proxy', Boolean(state.userRegistry), async () => {
  const registryIface = new ethers.Interface(ABI.userRegistry);
  const data = registryIface.encodeFunctionData('initialize', [[{ account: owner.address, roleBitmap: ALL_ROLES }]]);
  state.userRegistry = await deployProxy(SEPOLIA.userRegistryImpl, salt('UserRegistry', ethers.namehash(PARENT_NAME), 'bytes32'), data);
});

const resolverAddress = state.resolver as string;
const userRegistryAddress = state.userRegistry as string;
const resolver = new ethers.Contract(resolverAddress, ABI.resolver, owner);
const userRegistry = new ethers.Contract(userRegistryAddress, ABI.userRegistry, owner);

await step(`link ${PARENT_NAME} to the subname registry`, Boolean(state.linked), async () => {
  await send(registry.getFunction('setSubregistry')(BigInt(ethers.id(PARENT_LABEL)), userRegistryAddress));
  state.linked = true;
});

await step('deploy the certificate registrar', Boolean(state.registrar), async () => {
  const { abi, bytecode } = compileContract('CertificateRegistrar.sol', 'CertificateRegistrar');
  const factory = new ethers.ContractFactory(abi as ethers.InterfaceAbi, bytecode, owner);
  const contract = await factory.deploy(userRegistryAddress, agentAddress, resolverAddress);
  await contract.waitForDeployment();
  state.registrar = await contract.getAddress();
});

await step('let the registrar register and unregister names', Boolean(state.rolesGranted), async () => {
  await send(userRegistry.getFunction('grantRootRoles')(ROLE_REGISTRAR | ROLE_UNREGISTER, state.registrar));
  state.rolesGranted = true;
});

await step('let the issuer write only its own text keys', Boolean(state.setterRoles), async () => {
  const resolverIface = new ethers.Interface(ABI.resolver);
  for (const key of ISSUER_TEXT_KEYS) {
    const setter = resolverIface.encodeFunctionData('setText', ['0x', key, '']);
    await send(resolver.getFunction('grantSetterRoles')(setter, agentAddress));
    console.log(`        granted ${key}`);
  }
  state.setterRoles = true;
});

await step('upload the procedure to 0G Storage', Boolean(state.procedureRoot), async () => {
  const bytes = readFileSync(new URL('../../procedure/cnc-vmc.json', import.meta.url));
  const upload = await uploadBytes(new Uint8Array(bytes));
  if (!upload.ok) throw new Error(`0G upload failed: ${upload.reason}`);
  state.procedureRoot = upload.rootHash;
  console.log(`        root hash ${upload.rootHash}`);
});

const expiry = BigInt(Math.floor(Date.now() / 1000) + 364 * 24 * 3600);
const labels = [MACHINE_LABEL, GUIDE_LABEL];
await step('register the machine and guide names', (state.names ?? []).length === labels.length, async () => {
  state.names = state.names ?? [];
  for (const label of labels) {
    if (state.names.includes(label)) continue;
    await send(userRegistry.getFunction('register')(label, owner.address, ethers.ZeroAddress, resolverAddress, 0n, expiry));
    state.names.push(label);
    save();
  }
});

await step('write the machine passport and guide identity records', Boolean(state.recordsSet), async () => {
  const records: Array<[string, string, string]> = [
    [MACHINE_LABEL, 'description', 'CNC vertical machining center, simulated twin for operator training'],
    [MACHINE_LABEL, 'mrt.model', 'cnc-vmc-twin-1'],
    [MACHINE_LABEL, 'mrt.procedure', `0g://${state.procedureRoot}`],
    [MACHINE_LABEL, 'mrt.guide', `${GUIDE_LABEL}.${PARENT_NAME}`],
    [MACHINE_LABEL, 'mrt.guideVersion', '1.0.0'],
    [GUIDE_LABEL, 'agent-context', `AI technician for CNC VMC start-up and operation. Judges the trainee on 0G Compute (${config.ZG_COACH_MODEL}); evidence on 0G Storage and 0G Chain.`],
    [GUIDE_LABEL, 'mrt.model', config.ZG_COACH_MODEL],
    [GUIDE_LABEL, 'mrt.guideVersion', '1.0.0'],
  ];
  for (const [label, key, value] of records) {
    await send(resolver.getFunction('setText')(ethers.dnsEncode(`${label}.${PARENT_NAME}`), key, value));
    console.log(`        ${label}.${PARENT_NAME}  ${key}`);
  }
  state.recordsSet = true;
});

console.log('\nENS setup finished. Saved to backend/deployments/sepolia.json');
console.log(`  parent:     ${PARENT_NAME}`);
console.log(`  machine:    ${MACHINE_LABEL}.${PARENT_NAME}`);
console.log(`  guide:      ${GUIDE_LABEL}.${PARENT_NAME}`);
console.log(`  registrar:  https://sepolia.etherscan.io/address/${state.registrar}`);
console.log(`  resolver:   https://sepolia.etherscan.io/address/${state.resolver}`);
