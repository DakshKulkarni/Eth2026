import { CountUp } from './CountUp';

// A plain figure with a label. No card.
export function Stat({ label, value, suffix, caption }: { label: string; value: number | undefined; suffix?: string; caption?: string; i?: number }) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className="display mt-1.5 text-[34px] font-semibold tnum">
        {value === undefined ? <span className="skeleton inline-block h-8 w-14 align-middle" /> : <CountUp value={value} suffix={suffix} />}
      </p>
      {caption && <p className="mt-1 text-[12.5px] text-muted">{caption}</p>}
    </div>
  );
}
