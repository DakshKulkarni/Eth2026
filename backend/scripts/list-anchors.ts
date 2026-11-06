import { ethers } from 'ethers';
import { config } from '../src/config.js';

if (!config.ZG_REGISTRY_ADDRESS) {
  console.error('ZG_REGISTRY_ADDRESS is not set in backend/.env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(config.ZG_RPC_URL);
const iface = new ethers.Interface([
  'event SessionAnchored(bytes32 indexed sessionId, bytes32 rootHash, uint8 outcome, address indexed anchoredBy)',
]);
const event = iface.getEvent('SessionAnchored');
if (!event) throw new Error('event definition missing');

const latest = await provider.getBlockNumber();
const names: Record<number, string> = { 1: 'learn_complete', 2: 'test_pass', 3: 'test_fail', 4: 'abandoned' };
const logs = await provider.getLogs({
  address: config.ZG_REGISTRY_ADDRESS,
  topics: [event.topicHash],
  fromBlock: Math.max(0, latest - 40000),
  toBlock: latest,
});

console.log(`${logs.length} anchored session(s) in the last 40000 blocks:`);
for (const log of logs) {
  const parsed = iface.parseLog(log);
  if (!parsed) continue;
  console.log(`- ${names[Number(parsed.args.outcome)] ?? parsed.args.outcome}  root ${parsed.args.rootHash}  tx ${log.transactionHash}`);
}
