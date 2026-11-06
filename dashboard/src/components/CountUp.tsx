import { animate } from 'motion/react';
import { useEffect, useRef } from 'react';

// A number that counts up to its value.
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix;
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, decimals, suffix]);
  return (
    <span ref={ref} className="tnum">
      {value.toFixed(decimals) + suffix}
    </span>
  );
}
