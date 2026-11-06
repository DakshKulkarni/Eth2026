import * as Tooltip from '@radix-ui/react-tooltip';
import { LayoutGrid, Radio, ScrollText, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEventStream } from '../lib/events';
import { THEMES, setTheme, useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { Logo0G, LogoENS, LogoWorld } from './logos';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
interface NavItem { to: string; label: string; icon: Icon; tint: string; end?: boolean; logo?: boolean }

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, tint: 'var(--accent)', end: true },
  { to: '/0g', label: '0G', icon: Logo0G, tint: 'var(--g0)', logo: true },
  { to: '/ens', label: 'ENS', icon: LogoENS, tint: 'var(--ens)', logo: true },
  { to: '/world', label: 'World', icon: LogoWorld, tint: 'var(--world)', logo: true },
  { to: '/live', label: 'Live', icon: Radio, tint: 'var(--bad)' },
  { to: '/verify', label: 'Verify', icon: ShieldCheck, tint: 'var(--ok)' },
  { to: '/log', label: 'Log', icon: ScrollText, tint: 'var(--muted)' },
];

function Mark() {
  return (
    <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M7 24V8l9 8 9-8v16" />
      </svg>
    </div>
  );
}

function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => setTheme(t.id)}
          className={cn('size-5 rounded-full outline-offset-2 transition-transform hover:scale-110 focus-visible:outline-2', theme === t.id && 'outline-2 outline-ink')}
          style={{ background: t.swatch[0] }}
        />
      ))}
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const stream = useEventStream();
  const live = stream.status === 'live';

  return (
    <Tooltip.Provider delayDuration={100}>
      <div className="mx-auto min-h-dvh max-w-[1500px] px-4 pb-28 pt-4 md:px-6 md:pb-10">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark />
            <span className="display hidden text-[17px] sm:block">Smartician</span>
          </div>

          <nav className="hidden items-center gap-0.5 rounded-full bg-panel p-1.5 md:flex" aria-label="Sections">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="relative flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium text-muted outline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 aria-[current=page]:text-accent-ink">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <n.icon className={cn('relative', n.logo ? 'h-[13px] w-auto' : 'size-4')} strokeWidth={1.9} />
                    <span className="relative">{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full bg-panel px-3.5 py-2 text-[13px] font-medium xl:flex">
              <span className="lamp" style={{ ['--lamp' as string]: live ? 'var(--ok)' : 'var(--warn)' }} />
              {live ? 'Live' : stream.status === 'connecting' ? 'Connecting' : 'Offline'}
            </div>
            <div className="rounded-full bg-panel px-3.5 py-2.5"><ThemeSwitch /></div>
          </div>
        </header>

        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-full bg-panel-2 p-1.5 md:hidden" aria-label="Sections">
        {NAV.slice(0, 5).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="relative grid size-12 place-items-center rounded-full text-muted aria-[current=page]:text-accent-ink" aria-label={n.label}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-accent" />}
                <n.icon className={cn('relative', n.logo ? 'h-[15px] w-auto' : 'size-5')} strokeWidth={1.9} />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </Tooltip.Provider>
  );
}
