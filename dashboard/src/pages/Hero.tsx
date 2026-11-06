import { motion } from 'motion/react';
import { Logo0G, LogoENS, LogoWorld } from '../components/logos';
import { Plate } from '../components/Plate';

const TRACKS = [
  { name: '0G', tint: 'var(--g0)', Logo: Logo0G, role: 'Judge · Storage · Chain', line: 'The AI examiner decides every step. Each session is stored on 0G Storage and anchored on 0G Chain.' },
  { name: 'ENS', tint: 'var(--ens)', Logo: LogoENS, role: 'Licence · Records', line: 'A passed test becomes an expiring, revocable licence whose key-value records point back to the evidence.' },
  { name: 'World', tint: 'var(--world)', Logo: LogoWorld, role: 'Proof of human', line: 'A real person checks in with World before Test mode unlocks and a licence can be issued.' },
];

const PLATE = [
  ['Machine', 'cnc-01 · vertical machining centre'],
  ['Procedure', 'cnc-vmc 1.0.0 · 22 steps · 4 checkpoints'],
  ['Judge', 'qwen3.8-flash on the 0G Router'],
  ['Networks', '0G Galileo testnet · Ethereum Sepolia'],
];

export function Hero() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="plate flex flex-col justify-between gap-10 p-7 md:p-10">
          <p className="label">MR Machine Trainer</p>
          <h2 className="display text-[clamp(3rem,7.4vw,6.6rem)] font-bold">
            Every decision,<br />
            <span className="text-accent">on the record.</span>
          </h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            Follow the AI examiner, the evidence on 0G, the licence on ENS and the proof of human from World, as it happens, in one place.
          </p>
        </motion.section>

        <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="plate p-6">
          <p className="label mb-4 flex items-center gap-2"><span className="hazard inline-block size-2.5" aria-hidden />Data plate</p>
          <dl className="divide-y divide-line">
            {PLATE.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[92px_1fr] gap-3 py-3">
                <dt className="label pt-0.5">{k}</dt>
                <dd className="font-mono text-[13px] leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </motion.aside>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {TRACKS.map((t, i) => (
          <motion.div key={t.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Plate tint={t.tint} className="flex h-full flex-col gap-5 p-6">
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-[72px] place-items-center rounded-md border border-line bg-panel-2" style={{ color: t.tint }}>
                  <t.Logo className="h-[22px] w-auto" />
                </div>
                <span className="lamp mt-1" style={{ ['--lamp' as string]: t.tint }} aria-hidden />
              </div>
              <div>
                <h3 className="display text-[28px] font-semibold">{t.name}</h3>
                <p className="label mt-1.5">{t.role}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted">{t.line}</p>
            </Plate>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
