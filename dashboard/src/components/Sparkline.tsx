import { useId } from 'react';

// A small area chart. Values are drawn left to right, oldest first.
export function Sparkline({ values, height = 84, color = 'var(--g0)', unit = 'ms' }: { values: number[]; height?: number; color?: string; unit?: string }) {
  const id = useId();
  if (values.length < 2) return <div className="grid place-items-center text-xs text-muted" style={{ height }}>Needs a few verdicts to draw</div>;
  const w = 600;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => height - 8 - ((v - min) / span) * (height - 22);
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  const peak = values.indexOf(max);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={`Latency, ${values.length} verdicts, from ${min} to ${max} ${unit}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={height * f} y2={height * f} stroke="var(--line)" strokeDasharray="3 5" />)}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(peak)} cy={y(max)} r="3.2" fill={color} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between font-mono text-[10.5px] text-muted">
        <span>{max} {unit}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10.5px] text-muted">
        <span>{min} {unit}</span>
        <span>{values.length} verdicts</span>
      </div>
    </div>
  );
}
