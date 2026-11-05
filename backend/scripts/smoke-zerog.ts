import { chat } from '../src/zerog/client.js';

const result = await chat({
  messages: [{ role: 'user', content: 'Reply with the JSON object {"pong":true} and nothing else.' }],
  maxTokens: 30,
});

if (!result.ok) {
  console.error(`0G call failed: ${result.reason} (${result.detail}) after ${result.latencyMs} ms`);
  process.exit(1);
}
console.log(`requestId: ${result.requestId}`);
console.log(`model:     ${result.model}`);
console.log(`latency:   ${result.latencyMs} ms`);
console.log(`reply:     ${result.content}`);
