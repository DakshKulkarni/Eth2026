import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';
import { compileRegistry } from './compile-registry.js';

const problem = keyProblem();
if (problem || !config.AGENT_PRIVATE_KEY) {
  console.error(problem ?? 'AGENT_PRIVATE_KEY is not set in backend/.env');
  process.exit(1);
}

const wallet = new ethers.Wallet(config.AGENT_PRIVATE_KEY, new ethers.JsonRpcProvider(config.ZG_RPC_URL));
const balance = await wallet.provider?.getBalance(wallet.address);
console.log(`deployer: ${wallet.address}`);
console.log(`balance:  ${balance === undefined ? 'unknown' : ethers.formatEther(balance)} 0G`);

const { abi, bytecode } = compileRegistry();
const factory = new ethers.ContractFactory(abi as ethers.InterfaceAbi, bytecode, wallet);
const contract = await factory.deploy(wallet.address);
await contract.waitForDeployment();
const address = await contract.getAddress();

console.log(`\nSessionRegistry deployed: ${address}`);
console.log(`explorer: https://chainscan-galileo.0g.ai/address/${address}`);
console.log('\nAdd this line to backend/.env:');
console.log(`ZG_REGISTRY_ADDRESS=${address}`);
