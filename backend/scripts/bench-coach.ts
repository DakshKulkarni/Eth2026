import { config } from '../src/config.js';
import { coach } from '../src/judge/coach.js';
import type { Observe } from '../src/judge/schema.js';
import { createSession } from '../src/session.js';
import { loadProcedure } from '../src/shared/procedure.js';

const procedure = loadProcedure();
type Raw = { control: string; action: string; value: string };

const isolator: Raw = { control: 'isolator', action: 'set', value: 'on' };
const estop: Raw = { control: 'estop', action: 'set', value: 'released' };
const power: Raw = { control: 'power_btn', action: 'set', value: 'on' };
const modeHome: Raw = { control: 'mode_selector', action: 'set', value: 'HOME' };
const homeZ: Raw = { control: 'home_z', action: 'press', value: '' };
const homeXY: Raw = { control: 'home_xy', action: 'press', value: '' };
const tool: Raw = { control: 'tool_select', action: 'set', value: 'T1' };
const openDoor: Raw = { control: 'door', action: 'set', value: 'open' };
const place: Raw = { control: 'workpiece', action: 'set', value: 'placed' };
const closeDoor: Raw = { control: 'door', action: 'set', value: 'closed' };

const base = {
  door: 'closed', estop: 'released', isolator: 'on', power: 'on', mode: 'HOME',
  homed: { x: false, y: false, z: false }, clamped: false, tool: 'T3', program: null,
  feed: 100, coolant: false, cycle: 'idle',
};

function make(trigger: Observe['trigger'], raws: Raw[], machine: Partial<typeof base>): Observe {
  return {
    trigger,
    mode: 'learn',
    machine: { ...base, ...machine },
    actions: raws.map((a, i) => ({ seq: i + 1, t: i * 2, ...a })),
  };
}

const scenarios: Array<[string, Observe]> = [
  ['mistake: home XY before Z', make('action', [isolator, estop, power, modeHome, homeXY], { homed: { x: true, y: true, z: false } })],
  ['correct: stage 1 in order', make('checkpoint', [isolator, estop, power, modeHome, homeZ, homeXY], { homed: { x: true, y: true, z: true } })],
  ['harmless: tool before HOME mode', make('action', [isolator, estop, power, tool, modeHome], { tool: 'T1' })],
  ['mistake: door closed, not clamped', make('checkpoint', [isolator, estop, power, modeHome, homeZ, homeXY, tool, openDoor, place, closeDoor], { homed: { x: true, y: true, z: true }, tool: 'T1', clamped: false })],
];

const blockedPower: Raw = { control: 'power_btn', action: 'blocked', value: 'on refused: Release the E-STOP first' };
const blockedHome: Raw = { control: 'home_z', action: 'blocked', value: 'press refused: Select HOME mode first' };
scenarios.push(
  ['blocked: power on, E-stop engaged', make('action', [blockedPower], { estop: 'engaged', isolator: 'off', power: 'off', mode: 'JOG' })],
  ['blocked: home Z outside HOME mode', make('action', [isolator, estop, power, blockedHome], { mode: 'JOG' })],
);

console.log(`model: ${config.ZG_COACH_MODEL}`);
for (const [name, request] of scenarios) {
  const r = await coach(createSession(procedure.id), procedure, request);
  console.log(`${name.padEnd(36)} -> ${r.verdict.padEnd(9)} ${String(r.latencyMs).padStart(5)} ms  "${r.coachingLine}"`);
  for (const m of r.mistakes) console.log(`      ${m.stepId}: ${m.code} - ${m.explanation}`);
}
