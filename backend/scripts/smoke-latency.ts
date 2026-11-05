import { chat } from '../src/zerog/client.js';

const models = ['qwen3.8-flash', 'qwen3.5-flash', 'qwen3.7-flash', 'gemini-3.1-flash-lite', 'glm-5.3-flash'];

for (const model of models) {
  const result = await chat({
    model,
    messages: [{ role: 'user', content: 'Reply with the JSON object {"pong":true} and nothing else.' }],
    maxTokens: 30,
    timeoutMs: 30000,
  });
  if (result.ok) {
    console.log(`${model.padEnd(24)} OK    ${String(result.latencyMs).padStart(6)} ms  ${result.requestId}`);
  } else {
    console.log(`${model.padEnd(24)} FAIL  ${String(result.latencyMs).padStart(6)} ms  ${result.reason}: ${result.detail}`);
  }
}
