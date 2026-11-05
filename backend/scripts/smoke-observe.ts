const base = process.env.BACKEND_URL ?? 'http://localhost:8787';

const start = await fetch(`${base}/session/start`, { method: 'POST' });
const { sessionId } = (await start.json()) as { sessionId: string };

const actions = [
  { control: 'isolator', action: 'set', value: 'on' },
  { control: 'estop', action: 'set', value: 'released' },
  { control: 'power_btn', action: 'set', value: 'on' },
  { control: 'mode_selector', action: 'set', value: 'HOME' },
  { control: 'home_xy', action: 'press', value: '' },
].map((a, i) => ({ seq: i + 1, t: i * 2, ...a }));

const res = await fetch(`${base}/session/${sessionId}/observe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    trigger: 'checkpoint',
    checkpointId: 's1_home_xy',
    mode: 'learn',
    machine: {
      door: 'closed',
      estop: 'released',
      isolator: 'on',
      power: 'on',
      mode: 'HOME',
      homed: { x: true, y: true, z: false },
      clamped: false,
      tool: 'T3',
      program: null,
      feed: 100,
      coolant: false,
      cycle: 'idle',
    },
    actions,
  }),
});
console.log(res.status, JSON.stringify(await res.json(), null, 2));
