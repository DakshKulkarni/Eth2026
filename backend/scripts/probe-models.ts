import { config } from '../src/config.js';

const models = process.argv.slice(2);
const variants: Array<[string, Record<string, unknown>]> = [
  ['max_tokens', { max_tokens: 40 }],
  ['max_completion_tokens', { max_completion_tokens: 40 }],
  ['no limit', {}],
];

for (const model of models) {
  let line = `${model.padEnd(20)} `;
  for (const [name, extra] of variants) {
    const started = Date.now();
    try {
      const res = await fetch(`${config.ZG_ROUTER_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ZG_API_KEY ?? ''}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the JSON {"pong":true} only.' }], ...extra }),
        signal: AbortSignal.timeout(40000),
      });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text) as { choices?: Array<{ message?: { content?: string | null } }>; x_0g_trace?: { request_id?: string } };
        line += `OK with ${name} in ${Date.now() - started} ms, id=${data.x_0g_trace?.request_id ? 'yes' : 'NO'}, reply=${JSON.stringify(data.choices?.[0]?.message?.content ?? '').slice(0, 40)}`;
        break;
      }
      line += `[${name}: HTTP ${res.status} ${text.slice(0, 110).replace(/\s+/g, ' ')}] `;
    } catch (err) {
      line += `[${name}: ${err instanceof Error ? err.name : 'error'}] `;
    }
  }
  console.log(line);
}
