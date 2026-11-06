import { type HTMLAttributes, type PointerEvent, forwardRef } from 'react';
import { cn } from '../lib/utils';

interface Props extends HTMLAttributes<HTMLDivElement> {
  // The colour of the light that follows the pointer, as any CSS colour.
  tint?: string;
}

// A glass card whose highlight follows the pointer.
export const Spotlight = forwardRef<HTMLDivElement, Props>(function Spotlight({ tint, className, style, onPointerMove, children, ...rest }, ref) {
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
    onPointerMove?.(e);
  };
  return (
    <div ref={ref} onPointerMove={move} className={cn('glass spotlight', className)} style={{ ...(tint ? ({ '--spot': tint } as object) : {}), ...style }} {...rest}>
      {children}
    </div>
  );
});
