import { motion } from 'motion/react';
import { Spotlight } from '../components/Spotlight';

const TRACKS = [
  { name: '0G', tint: 'var(--g0)', line: 'AI judge, Storage and Chain' },
  { name: 'ENS', tint: 'var(--ens)', line: 'Licences and key-value records' },
  { name: 'World', tint: 'var(--world)', line: 'Proof of human at check-in' },
];

export function Hero() {
  return (
    <div className="grid gap-5">
      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="glass relative overflow-hidden p-8 md:p-12">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">MR Machine Trainer</p>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-tight text-gradient">
          Every decision, proven in the open.
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
          One place to follow the AI examiner, the evidence on 0G, the licence on ENS and the proof of human from World, as it happens.
        </p>
      </motion.section>
      <div className="grid gap-5 md:grid-cols-3">
        {TRACKS.map((t, i) => (
          <motion.div key={t.name} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
            <Spotlight tint={t.tint} className="p-6">
              <div className="flex items-center gap-2.5">
                <span className="size-2.5 rounded-full" style={{ background: t.tint, boxShadow: `0 0 14px ${t.tint}` }} />
                <h3 className="font-display text-xl font-semibold">{t.name}</h3>
              </div>
              <p className="mt-2 text-sm text-muted">{t.line}</p>
            </Spotlight>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
