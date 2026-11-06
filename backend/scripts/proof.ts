import { ethers } from 'ethers';
import { config } from '../src/config.js';
import { downloadBundle } from '../src/episode/storage.js';
import { loadDeployment } from '../src/ens/deployment.js';
import { checkCredential } from '../src/ens/read.js';
import { explorer } from '../src/explorer.js';

const OUTCOMES: Record<number, string> = { 1: 'learn_complete', 2: 'test_pass', 3: 'test_fail', 4: 'abandoned' };
const wanted = process.argv[2];

if (!config.ZG_REGISTRY_ADDRESS) throw new Error('ZG_REGISTRY_ADDRESS is not set');
const zg = new ethers.JsonRpcProvider(config.ZG_RPC_URL);
const anchorIface = new ethers.Interface([
  'event SessionAnchored(bytes32 indexed sessionId, bytes32 rootHash, uint8 outcome, address indexed anchoredBy)',
]);
const topic = anchorIface.getEvent('SessionAnchored')!.topicHash;
const zgLatest = await zg.getBlockNumber();
const anchors = (await zg.getLogs({ address: config.ZG_REGISTRY_ADDRESS, topics: [topic], fromBlock: Math.max(0, zgLatest - 40000), toBlock: zgLatest })).map(
  (log) => ({ parsed: anchorIface.parseLog(log)!, log }),
);

console.log(`\n=== 0G: ${anchors.length} anchored session(s) in the last 40000 blocks ===`);
for (const { parsed, log } of anchors) {
  console.log(`- ${OUTCOMES[Number(parsed.args.outcome)] ?? parsed.args.outcome}  root ${parsed.args.rootHash}\n    chain tx ${explorer.chainTx(log.transactionHash)}`);
}

const pick = [...anchors].reverse().find((a) => (wanted ? a.parsed.args.rootHash === wanted : OUTCOMES[Number(a.parsed.args.outcome)] === 'test_pass'));
if (pick) {
  const root = String(pick.parsed.args.rootHash);
  console.log(`\n=== Episode from 0G Storage: ${root} ===`);
  const result = await downloadBundle(root);
  if (!result.ok) console.log(`download or verification FAILED: ${result.reason}`);
  else {
    const b = result.bundle;
    const count = (kind: string) => b.records.filter((r) => r.kind === kind).length;
    console.log(`downloaded from 0G Storage and the hash chain verifies (${b.records.length} records, head ${b.headHash.slice(0, 18)}...)`);
    console.log(`session ${b.sessionId}  model ${b.coachModel}  outcome ${b.outcome}`);
    console.log(`started ${b.startedAt}  ended ${b.endedAt}`);
    console.log(`observations judged by 0G: ${count('observe')}   voice lines: ${count('speech')}`);
  }
}

console.log('\n=== ENS certificates (Sepolia) ===');
const sepolia = new ethers.JsonRpcProvider(config.SEPOLIA_RPC_URL);
const deployment = loadDeployment();
const latest = await sepolia.getBlockNumber();
const certIface = new ethers.Interface(['event CertificateIssued(string label, address indexed holder, uint64 expiry)']);
const resolverIface = new ethers.Interface(['function multicall(bytes[] data)', 'function setText(bytes name, string key, string value)']);
const issued = await sepolia.getLogs({ address: deployment.registrar, topics: [certIface.getEvent('CertificateIssued')!.topicHash], fromBlock: latest - 9000, toBlock: 'latest' });
const resolverLogs = await sepolia.getLogs({ address: deployment.resolver, fromBlock: latest - 9000, toBlock: 'latest' });
const recordTxs = [...new Set(resolverLogs.map((l) => l.transactionHash))];

for (const log of issued.slice(-4)) {
  const label = String(certIface.parseLog(log)!.args.label);
  const c = await checkCredential(label);
  console.log(`\n${c.name}  ${c.valid ? 'VALID' : 'NOT VALID (' + c.reason + ')'}  expires ${c.expiresAt}`);
  console.log(`  issue tx   ${explorer.sepoliaTx(log.transactionHash)}`);
  for (const hash of recordTxs) {
    const tx = await sepolia.getTransaction(hash);
    if (!tx) continue;
    let calls: string[];
    try {
      const top = resolverIface.parseTransaction({ data: tx.data });
      if (top?.name !== 'multicall') continue;
      calls = Array.from(top.args[0] as Iterable<string>);
    } catch {
      continue;
    }
    const mine = calls.map((d) => resolverIface.parseTransaction({ data: d })).filter((p): p is ethers.TransactionDescription => p !== null).filter((p) => ethers.toUtf8String(p.args.name).replace(/[\x00-\x1f]/g, '.').includes(`.${label}.smartician.eth`));
    if (mine.length === 0) continue;
    console.log(`  records tx ${explorer.sepoliaTx(hash)}`);
    for (const p of mine) console.log(`    ${p.args.key} = ${String(p.args.value).slice(0, 90)}`);
  }
  const evidence = c.evidence?.replace('0g://', '');
  console.log(`  live read: alias=${c.alias ?? '-'} class=${c.class ?? '-'} verdict=${c.verdict ?? '-'} evidence=${evidence ?? '-'}`);
  if (evidence) console.log(`  evidence matches a 0G anchor: ${anchors.some((a) => String(a.parsed.args.rootHash) === evidence) ? 'YES' : 'no (older than the scanned window)'}`);
}
