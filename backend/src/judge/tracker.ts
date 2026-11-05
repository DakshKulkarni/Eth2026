import type { Procedure, Step } from '../shared/procedure.js';

export interface Action {
  seq: number;
  t: number;
  control: string;
  action: string;
  value: string;
}

export class Tracker {
  private done = new Set<string>();
  private violated: string[] = [];

  constructor(private readonly procedure: Procedure) {}

  get completed(): string[] {
    return [...this.done];
  }

  get currentStage(): number {
    for (const stage of this.procedure.stages) {
      if (this.procedure.steps.some((s) => s.stage === stage.id && !this.done.has(s.id))) return stage.id;
    }
    return this.procedure.stages[this.procedure.stages.length - 1]?.id ?? 0;
  }

  get currentStepId(): string | null {
    return this.procedure.steps.find((s) => s.stage === this.currentStage && !this.done.has(s.id))?.id ?? null;
  }

  apply(a: Action): void {
    const hit = this.procedure.steps.find(
      (s) => s.stage === this.currentStage && !this.done.has(s.id) && this.matches(s, a),
    );
    if (!hit) return;
    if (hit.forbiddenBefore.some((id) => !this.done.has(id))) this.violated.push(hit.id);
    this.done.add(hit.id);
  }

  get pendingViolations(): Step[] {
    return this.violated.flatMap((id) => this.procedure.steps.filter((s) => s.id === id));
  }

  clearViolations(): void {
    this.violated = [];
  }

  private matches(step: Step, a: Action): boolean {
    const e = step.expectedAction;
    return e.control === a.control && e.action === a.action && e.value.toLowerCase() === a.value.toLowerCase();
  }
}
