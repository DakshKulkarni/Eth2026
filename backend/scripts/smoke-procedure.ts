import { loadProcedure } from '../src/shared/procedure.js';

const p = loadProcedure();
console.log(`${p.id} v${p.version}: ${p.stages.length} stages, ${p.steps.length} steps`);
for (const stage of p.stages) {
  const steps = p.steps.filter((s) => s.stage === stage.id);
  console.log(`  stage ${stage.id} ${stage.title}: ${steps.length} steps, ${steps.filter((s) => s.checkpoint).length} checkpoints`);
}
