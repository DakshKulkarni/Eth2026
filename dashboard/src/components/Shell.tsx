import * as Tooltip from '@radix-ui/react-tooltip';
import { Command, LayoutGrid, Radio, ScrollText, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { THEMES, setTheme, useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { Background } from './Background';
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
    <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-ink" aria-hidden>
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M7 24V8l9 8 9-8v16" />
      </svg>
    </div>
  );
}

function ThemeSwitch({ vertical }: { vertical?: boolean }) {
  const theme = useTheme();
  return (
    <div className={cn('flex gap-1.5', vertical && 'flex-col')} role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => setTheme(t.id)}
          className={cn('size-5 rounded-[4px] border border-line outline-offset-2 transition-transform hover:scale-110 focus-visible:outline-2', theme === t.id && 'outline-2 outline-ink')}
          style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }}
        />
      ))}
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const section = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  return (
    <Tooltip.Provider delayDuration={100}>
      <Background />
      <div className="mx-auto flex min-h-dvh max-w-[1600px] md:gap-5 md:p-5">
        <aside className="plate sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[72px] shrink-0 flex-col items-center py-4 md:flex">
          <Mark />
          <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
            {NAV.map((n) => (
              <Tooltip.Root key={n.to}>
                <Tooltip.Trigger asChild>
                  <NavLink to={n.to} end={n.end} aria-label={n.label} className="relative grid size-11 place-items-center rounded-md text-muted outline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 aria-[current=page]:text-ink">
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-md border border-line bg-panel-2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                        {isActive && <motion.span layoutId="nav-bar" className="absolute -left-[13px] h-6 w-[3px] bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                        <n.icon className={cn('relative', n.logo ? 'h-[15px] w-auto' : 'size-[19px]')} style={{ color: isActive ? n.tint : undefined }} strokeWidth={1.7} />
                      </>
                    )}
                  </NavLink>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="right" sideOffset={12} className="label z-50 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 !text-ink shadow-lg">
                    {n.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
          </nav>
          <ThemeSwitch vertical />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 pt-4 md:px-0 md:pb-0 md:pt-0">
          <header className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className="md:hidden"><Mark /></div>
              <div>
                <p className="label flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Proof Deck</p>
                <h1 className="display mt-1.5 text-[34px] font-semibold">{section?.label ?? 'Proof'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="label hidden items-center gap-2 border border-line bg-panel px-2.5 py-1.5 sm:flex" style={{ borderRadius: 4 }}>
                <span className="lamp" /> Live
              </div>
              <button className="label flex items-center gap-2 border border-line bg-panel px-2.5 py-1.5 transition-colors hover:!text-ink" style={{ borderRadius: 4 }} aria-label="Open command palette">
                <Command className="size-3.5" /> <span className="hidden sm:inline">Search</span> <kbd className="font-mono">⌘K</kbd>
              </button>
              <div className="md:hidden"><ThemeSwitch /></div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <nav className="plate fixed inset-x-3 bottom-3 z-40 flex justify-around p-1.5 md:hidden" aria-label="Sections">
          {NAV.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="relative grid size-12 place-items-center rounded-md text-muted aria-[current=page]:text-ink" aria-label={n.label}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="tab-active" className="absolute inset-0 rounded-md bg-panel-2" />}
                  <n.icon className={cn('relative', n.logo ? 'h-[15px] w-auto' : 'size-5')} style={{ color: isActive ? n.tint : undefined }} strokeWidth={1.7} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </Tooltip.Provider>
  );
}
