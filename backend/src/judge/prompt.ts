import type { ChatMessage, ContentPart } from '../zerog/client.js';
import type { Procedure, Step } from '../shared/procedure.js';
import type { Observe } from './schema.js';

const SYSTEM = `You are an AI technician supervising a trainee who operates a CNC vertical machining center in a mixed-reality simulator.
You get the standard procedure (SOP), the live machine state, the actions since your last check, the steps the server has tracked as completed, and sometimes an image of what the trainee currently sees. The JSON state is authoritative; use the image only to confirm it.
Decide if the trainee is on track and reply with JSON only:
{"verdict":"ok"|"correct"|"unsafe","mistakes":[{"stepId":"...","code":"snake_case","explanation":"one sentence"}],"coachingLine":"..."}
Rules:
- "ok": the trainee follows the SOP, or is only exploring harmlessly. Leave coachingLine empty.
- "correct": a step was skipped or done out of order, or the machine state is wrong for what comes next (for example the door is closed while the workpiece is not clamped, a cycle ran without a dry run, or coolant is off for production).
- "unsafe": continuing risks a crash or injury. Use this only when the risk is real.
- coachingLine is spoken aloud to the trainee: at most 25 words, calm, specific, name the control, say what to do now. Never repeat a correction listed in previousCoaching.
- In test mode do not reveal upcoming steps unless you are correcting a mistake.
- Use the step ids from the SOP in mistakes. Reply with the JSON object and nothing else.`;

function sopLine(s: Step): string {
  const needs = s.forbiddenBefore.length > 0 ? ` (needs first: ${s.forbiddenBefore.join(', ')})` : '';
  const cp = s.checkpoint ? ' [checkpoint]' : '';
  return `${s.id} stage ${s.stage}: ${s.title} -> ${s.expectedAction.control} ${s.expectedAction.action} ${s.expectedAction.value}${cp}${needs}`;
}

export interface PromptFacts {
  procedure: Procedure;
  currentStepId: string | null;
  completed: string[];
  violations: Step[];
  previousCoaching: string[];
}

export function buildMessages(req: Observe, facts: PromptFacts): ChatMessage[] {
  const state = {
    trigger: req.trigger,
    checkpointId: req.checkpointId ?? null,
    mode: req.mode,
    currentStepId: facts.currentStepId,
    completedSteps: facts.completed,
    serverDetectedOrderViolations: facts.violations.map((s) => s.id),
    previousCoaching: facts.previousCoaching,
    machine: req.machine,
    newActions: req.actions,
  };
  const text = `SOP:\n${facts.procedure.steps.map(sopLine).join('\n')}\n\nOBSERVATION:\n${JSON.stringify(state)}`;
  const parts: ContentPart[] = [{ type: 'text', text }];
  if (req.frame) parts.push({ type: 'image_url', image_url: { url: req.frame } });
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: parts },
  ];
}
