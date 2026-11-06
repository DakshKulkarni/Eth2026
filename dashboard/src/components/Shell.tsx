import * as Tooltip from '@radix-ui/react-tooltip';
import { BadgeCheck, Command, Cpu, Fingerprint, LayoutGrid, Radio, ScrollText, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { THEMES, setTheme, useTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { Background } from './Background';

interface NavItem { to: string; label: string; icon: typeof LayoutGrid; tint: string; end?: boolean }
const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutGrid, tint: 'var(--accent)', end: true },
  { to: '/0g', label: '0G', icon: Cpu, tint: 'var(--g0)' },
  { to: '/ens', label: 'ENS', icon: BadgeCheck, tint: 'var(--ens)' },
  { to: '/world', label: 'World', icon: Fingerprint, tint: 'var(--world)' },
  { to: '/live', label: 'Live', icon: Radio, tint: 'var(--bad)' },
  { to: '/verify', label: 'Verify', icon: ShieldCheck, tint: 'var(--ok)' },
  { to: '/log', label: 'Log', icon: ScrollText, tint: 'var(--muted)' },
];

function Mark() {
  return (
    <div className="relative grid size-10 place-items-center rounded-2xl border border-line bg-surface-2">
      <svg viewBox="0 0 32 32" className="size-6" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 22V10l8 6 8-6v12" />
      </svg>
      <span className="absolute inset-0 -z-10 rounded-2xl opacity-60 blur-xl" style={{ background: 'var(--accent)' }} />
    </div>
  );
}

function ThemeDots() {
  const theme = useTheme();
  return (
    <div className="flex gap-1.5 rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => setTheme(t.id)}
          className={cn('size-5 rounded-full outline-offset-2 transition-transform hover:scale-110 focus-visible:outline-2', theme === t.id && 'ring-2 ring-ink/80 ring-offset-2 ring-offset-bg')}
          style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
        />
      ))}
    </div>
  );
}

export function Shell() {
  const location = useLocation();
  const section = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  return (
    <Tooltip.Provider delayDuration={120}>
      <Background />
      <div className="mx-auto flex min-h-dvh max-w-[1600px] gap-0 md:gap-6 md:p-6">
        {/* Sidebar on larger screens */}
        <aside className="glass sticky top-6 hidden h-[calc(100dvh-3rem)] w-[76px] shrink-0 flex-col items-center gap-2 py-5 md:flex">
          <Mark />
          <nav className="mt-4 flex flex-1 flex-col items-center gap-1.5">
            {NAV.map((n) => (
              <Tooltip.Root key={n.to}>
                <Tooltip.Trigger asChild>
                  <NavLink to={n.to} end={n.end} className="relative grid size-11 place-items-center rounded-2xl text-muted outline-offset-2 transition-colors hover:text-ink focus-visible:outline-2 aria-[current=page]:text-ink">
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-2xl border border-line bg-surface-2" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                        <n.icon className="relative size-[19px]" style={isActive ? { color: n.tint } : undefined} strokeWidth={1.8} />
                        {isActive && <span className="absolute -left-[13px] h-5 w-[3px] rounded-r-full" style={{ background: n.tint }} />}
                      </>
                    )}
                  </NavLink>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content side="right" sideOffset={12} className="z-50 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink shadow-xl backdrop-blur-xl">
                    {n.label}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))}
          </nav>
          <ThemeDots />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col px-4 pb-24 pt-5 md:px-0 md:pb-0 md:pt-0">
          <header className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="md:hidden"><Mark /></div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Proof Deck</p>
                <h1 className="font-display text-[26px] font-semibold leading-none tracking-tight">{section?.label ?? 'Proof'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted sm:flex">
                <span className="live-dot" /> Live
              </div>
              <button className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink" aria-label="Open command palette">
                <Command className="size-3.5" /> <span className="hidden sm:inline">Search</span> <kbd className="rounded border border-line px-1 font-mono text-[10px]">⌘K</kbd>
              </button>
              <div className="md:hidden"><ThemeDots /></div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Tab bar on phones */}
        <nav className="glass fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-3xl p-1.5 md:hidden" aria-label="Sections">
          {NAV.slice(0, 5).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="relative grid size-12 place-items-center rounded-2xl text-muted aria-[current=page]:text-ink" aria-label={n.label}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-surface-2" />}
                  <n.icon className="relative size-5" style={isActive ? { color: n.tint } : undefined} strokeWidth={1.8} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </Tooltip.Provider>
  );
}
