import { writeFileSync } from 'node:fs';
import { speak } from '../src/zerog/speech.js';

const out = process.argv[2] ?? '/tmp/coach-smoke.wav';
const result = await speak('You skipped Z-axis homing. Press the HOME Z button now.');

if (!result.ok) {
  console.error(`0G speech failed: ${result.reason} (${result.detail}) after ${result.latencyMs} ms`);
  process.exit(1);
}
writeFileSync(out, result.audio);
console.log(`type:      ${result.contentType}`);
console.log(`bytes:     ${result.audio.length}`);
console.log(`requestId: ${result.requestId ?? '(none in headers)'}`);
console.log(`latency:   ${result.latencyMs} ms`);
console.log(`saved:     ${out}`);
