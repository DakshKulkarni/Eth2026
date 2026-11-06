import { buildBundle, verifyBundle } from '../src/episode/bundle.js';
import { EpisodeLog, verifyChain } from '../src/episode/chain.js';

const log = new EpisodeLog();
log.append('session_start', { procedureId: 'cnc-vmc' });
log.append('observe', { trigger: 'action', result: { verdict: 'correct', requestId: 'req-1', latencyMs: 2700 } });
log.append('observe', { trigger: 'checkpoint', result: { verdict: 'ok', requestId: 'req-2', latencyMs: 2400 } });
log.append('session_end', { outcome: 'learn_complete' });

const bundle = buildBundle({
  sessionId: 'demo-session',
  procedureId: 'cnc-vmc',
  procedureVersion: '1.0.0',
  coachModel: 'qwen3.8-flash',
  startedAt: new Date().toISOString(),
  outcome: 'learn_complete',
  records: log.all,
  headHash: log.head,
});

const roundTrip = JSON.parse(JSON.stringify(bundle)) as unknown;
const good = verifyBundle(roundTrip);
console.log(`untouched bundle:    ${good.ok ? 'verified' : `REJECTED (${good.reason})`}`);

const edited = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
const second = edited.records[1];
if (second) second.data = { trigger: 'action', result: { verdict: 'ok', requestId: 'req-1', latencyMs: 2700 } };
const tampered = verifyBundle(edited);
console.log(`edited verdict:      ${tampered.ok ? 'NOT DETECTED (bug)' : `rejected: ${tampered.reason}`}`);

const dropped = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
dropped.records.splice(1, 1);
const removed = verifyChain(dropped.records);
console.log(`deleted a record:    ${removed.ok ? 'NOT DETECTED (bug)' : `rejected: ${removed.reason}`}`);

const reordered = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
reordered.records.reverse();
const swapped = verifyChain(reordered.records);
console.log(`reordered records:   ${swapped.ok ? 'NOT DETECTED (bug)' : `rejected: ${swapped.reason}`}`);

if (!good.ok || tampered.ok || removed.ok || swapped.ok) process.exit(1);
