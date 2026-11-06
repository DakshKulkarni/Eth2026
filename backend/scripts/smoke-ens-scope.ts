import { ethers } from 'ethers';
import { config, keyProblem } from '../src/config.js';
import { ABI, GUIDE_LABEL, MACHINE_LABEL, PARENT_NAME } from '../src/ens/constants.js';
import { loadDeployment } from '../src/ens/deployment.js';

if (keyProblem('AGENT_PRIVATE_KEY')) {
  console.error(keyProblem('AGENT_PRIVATE_KEY'));
  process.exit(1);
}

const agent = new ethers.Wallet(config.AGENT_PRIVATE_KEY as string, new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL));
const resolver = new ethers.Contract(loadDeployment().resolver, ABI.resolver, agent);
const target = ethers.dnsEncode(`${MACHINE_LABEL}.${PARENT_NAME}`);

console.log(`issuer wallet ${agent.address} on resolver ${loadDeployment().resolver}`);
console.log('(simulated calls, nothing is sent and no gas is spent)\n');

let wrong = 0;
for (const key of ['mrt.evidence', 'mrt.verdict', 'mrt.issuedAt', 'mrt.model', 'mrt.procedure', 'description', 'agent-context', 'mrt.approval']) {
  const allowed = key === 'mrt.evidence' || key === 'mrt.verdict' || key === 'mrt.issuedAt';
  let result: string;
  try {
    await resolver.getFunction('setText').staticCall(target, key, 'probe');
    result = 'ALLOWED';
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    result = text.includes('EACUnauthorizedAccountRoles') || text.includes('0x') || text.includes('revert') ? 'REFUSED' : 'REFUSED (other error)';
  }
  const expected = allowed ? 'ALLOWED' : 'REFUSED';
  const ok = result.startsWith(expected);
  if (!ok) wrong++;
  console.log(`${key.padEnd(16)} ${result.padEnd(22)} expected ${expected} ${ok ? 'OK' : 'MISMATCH'}`);
}
console.log(`\nGuide label: ${GUIDE_LABEL}.${PARENT_NAME}; scoped permissions ${wrong === 0 ? 'behave exactly as designed' : 'DO NOT match the design'}`);
process.exit(wrong === 0 ? 0 : 1);
