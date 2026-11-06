import { anchorSession, readAnchor } from '../src/chain/anchor.js';
import { buildBundle } from '../src/episode/bundle.js';
import { EpisodeLog } from '../src/episode/chain.js';
import { downloadBundle, uploadBundle } from '../src/episode/storage.js';

const sessionId = `smoke-${Date.now()}`;
const log = new EpisodeLog();
log.append('session_start', { procedureId: 'cnc-vmc', note: 'evidence smoke test' });
log.append('session_end', { outcome: 'abandoned' });
const bundle = buildBundle({
  sessionId,
  procedureId: 'cnc-vmc',
  procedureVersion: '1.0.0',
  coachModel: 'smoke-test',
  startedAt: new Date().toISOString(),
  outcome: 'abandoned',
  records: log.all,
  headHash: log.head,
});

console.log('1. uploading the episode bundle to 0G Storage (can take up to a minute)...');
const upload = await uploadBundle(bundle);
if (!upload.ok) {
  console.error(`upload failed: ${upload.reason}`);
  process.exit(1);
}
console.log(`   rootHash: ${upload.rootHash}`);
console.log(`   storage tx: ${upload.txHash}`);

console.log('2. anchoring the root hash on 0G Chain...');
const anchor = await anchorSession(sessionId, upload.rootHash, 'abandoned');
if (!anchor.ok) console.error(`   anchor failed: ${anchor.reason}`);
else {
  console.log(`   anchor tx: ${anchor.txHash}`);
  console.log(`   explorer:  https://chainscan-galileo.0g.ai/tx/${anchor.txHash}`);
  const stored = await readAnchor(sessionId);
  console.log(`   read back from the contract: ${stored ? `${stored.rootHash === upload.rootHash ? 'matches' : 'MISMATCH'} (outcome ${stored.outcome})` : 'not found'}`);
}

console.log('3. downloading by root hash and verifying the chain (retries while nodes sync)...');
for (let attempt = 1; attempt <= 8; attempt++) {
  const check = await downloadBundle(upload.rootHash);
  if (check.ok) {
    console.log(`   verified: ${check.bundle.records.length} records, headHash ${check.bundle.headHash.slice(0, 16)}...`);
    process.exit(0);
  }
  console.log(`   attempt ${attempt}: ${check.reason}`);
  await new Promise((r) => setTimeout(r, 8000));
}
console.error('download did not verify in time');
process.exit(1);
