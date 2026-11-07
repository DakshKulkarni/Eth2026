import { cn } from '../lib/utils';

type Machine = Record<string, unknown> | null | undefined;
const s = (v: unknown): string => (v == null ? '' : String(v));

function Lamp({ on, danger, label, value }: { on: boolean; danger?: boolean; label: string; value?: string }) {
  const color = danger ? 'var(--bad)' : 'var(--ok)';
  return (
    <div className="flex items-center gap-2.5 bg-panel-2 px-3 py-2" style={{ borderRadius: 12 }}>
      <span className="size-2.5 shrink-0 rounded-[2px] transition-colors duration-300" style={{ background: on ? color : 'var(--line)', boxShadow: on ? `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)` : 'none' }} />
      <span className="label !tracking-[0.1em]">{label}</span>
      {value && <span className="ml-auto font-mono text-[12px]">{value}</span>}
    </div>
  );
}

const NAMES: Record<string, string> = {
  isolator: 'Main switch', estop: 'E-stop', workpiece: 'Part', clamp_handle: 'Clamp', guard: 'Guard', bit_select: 'Drill bit',
  speed_select: 'Speed', depth_select: 'Depth stop', oil_btn: 'Cutting oil', spindle_btn: 'Motor', hole: 'Hole',
};
const DANGER = new Set(['estop', 'guard']);
const ACTIVE: Record<string, string[]> = { isolator: ['on'], estop: ['engaged'], workpiece: ['placed'], clamp_handle: ['clamped'], guard: ['open'], oil_btn: ['on'], spindle_btn: ['on'] };

// Any machine that reports its controls by id, such as the drill press.
function GenericTwin({ m }: { m: Record<string, unknown> }) {
  const running = s(m.cycle) === 'running';
  const keys = Object.keys(m).filter((k) => k !== 'cycle');
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between bg-panel-2 px-4 py-3" style={{ borderRadius: 12 }}>
        <span className="label">Drilling</span>
        <span className={cn('display text-[22px] font-semibold', running ? 'text-accent' : 'text-muted')}>{running ? 'Running' : 'Idle'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {keys.map((k) => (
          <Lamp key={k} on={(ACTIVE[k] ?? []).includes(s(m[k]))} danger={DANGER.has(k)} label={NAMES[k] ?? k} value={s(m[k]).toUpperCase()} />
        ))}
      </div>
    </div>
  );
}

// The machine as the headset sees it: a control panel whose lamps follow the recorded state.
export function MachineTwin({ machine }: { machine: Machine }) {
  const m = (machine ?? {}) as Record<string, unknown>;
  if (machine && !('door' in m) && !('homed' in m)) return <GenericTwin m={m} />;
  const homed = (m.homed ?? {}) as Record<string, boolean>;
  const mode = s(m.mode);
  const running = s(m.cycle) === 'running';
  const feed = typeof m.feed === 'number' ? m.feed : 0;
  const none = !machine;

  return (
    <div className={cn('grid gap-3 transition-opacity', none && 'opacity-40')}>
      <div className="flex items-center justify-between bg-panel-2 px-4 py-3" style={{ borderRadius: 12 }}>
        <span className="label">Cycle</span>
        <span className={cn('display text-[22px] font-semibold', running ? 'text-accent' : 'text-muted')}>{none ? '—' : running ? 'Running' : 'Idle'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Lamp on={s(m.isolator) === 'on'} label="Isolator" value={s(m.isolator).toUpperCase()} />
        <Lamp on={s(m.estop) === 'engaged'} danger label="E-stop" value={s(m.estop).toUpperCase()} />
        <Lamp on={s(m.power) === 'on'} label="Power" value={s(m.power).toUpperCase()} />
        <Lamp on={s(m.door) === 'open'} danger label="Door" value={s(m.door).toUpperCase()} />
        <Lamp on={Boolean(m.clamped)} label="Clamp" value={m.clamped ? 'LOCKED' : 'OPEN'} />
        <Lamp on={Boolean(m.coolant)} label="Coolant" value={m.coolant ? 'ON' : 'OFF'} />
      </div>
      <div className="bg-panel-2 p-3" style={{ borderRadius: 12 }}>
        <p className="label mb-2">Mode</p>
        <div className="grid grid-cols-4 gap-1.5">
          {['HOME', 'JOG', 'DRY', 'AUTO'].map((x) => (
            <span key={x} className={cn('grid h-8 place-items-center border font-mono text-[11.5px] transition-colors duration-300', mode === x ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted')} style={{ borderRadius: 8 }}>{x}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {(['x', 'y', 'z'] as const).map((a) => <Lamp key={a} on={Boolean(homed[a])} label={`Home ${a.toUpperCase()}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-panel-2 px-3 py-2" style={{ borderRadius: 12 }}>
          <p className="label">Tool · Program</p>
          <p className="mt-1 font-mono text-[13px]">{s(m.tool) || '—'} · {s(m.program) || '—'}</p>
        </div>
        <div className="bg-panel-2 px-3 py-2" style={{ borderRadius: 12 }}>
          <p className="label flex justify-between"><span>Feed</span><span className="font-mono">{none ? '—' : `${feed}%`}</span></p>
          <div className="mt-2 h-1.5 bg-line"><div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.min(100, feed / 1.5)}%` }} /></div>
        </div>
      </div>
    </div>
  );
}
