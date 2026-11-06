import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ethers } from 'ethers';

const envPath = new URL('../.env', import.meta.url);
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

if (/^AGENT_PRIVATE_KEY=\S+/m.test(current)) {
  console.error('AGENT_PRIVATE_KEY is already set in backend/.env, so I did not change anything.');
  process.exit(1);
}

const wallet = ethers.Wallet.createRandom();
const line = `AGENT_PRIVATE_KEY=${wallet.privateKey}`;
const next = /^AGENT_PRIVATE_KEY=.*$/m.test(current)
  ? current.replace(/^AGENT_PRIVATE_KEY=.*$/m, line)
  : `${current}${current === '' || current.endsWith('\n') ? '' : '\n'}${line}\n`;
writeFileSync(envPath, next, { mode: 0o600 });

console.log('New wallet created and saved to backend/.env (the key is not shown here).');
console.log(`Address: ${wallet.address}`);
console.log('\nNext: send testnet tokens to that address at https://faucet.0g.ai (0.1 0G per day).');
