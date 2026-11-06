import { type HTMLAttributes, type PointerEvent, forwardRef } from 'react';
import { cn } from '../lib/utils';

interface Props extends HTMLAttributes<HTMLDivElement> {
  // Colour of the faint light that follows the pointer, as any CSS colour.
  tint?: string;
  // Turn the pointer light off for dense, always-visible panels.
  still?: boolean;
}

export const Plate = forwardRef<HTMLDivElement, Props>(function Plate({ tint, still, className, style, onPointerMove, children, ...rest }, ref) {
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!still) {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    onPointerMove?.(e);
  };
  return (
    <div ref={ref} onPointerMove={move} className={cn('plate', !still && 'plate-live', className)} style={{ ...(tint ? ({ '--spot': tint } as object) : {}), ...style }} {...rest}>
      {!still && <span className="sheen" aria-hidden />}
      {children}
    </div>
  );
});
