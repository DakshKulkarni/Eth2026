import type { ChatMessage, ContentPart } from '../zerog/client.js';
import type { Procedure, Step } from '../shared/procedure.js';
import type { Action, Observe } from './schema.js';

const SYSTEM = `You are the only judge of a trainee who operates a CNC vertical machining center in a mixed-reality simulator. No other system checks the trainee's work: your verdict decides whether they may move on, so judge carefully.
You get the standard procedure (SOP), the live machine state, every action the trainee has taken so far, the newest actions, and sometimes an image of what they currently see. The JSON state is authoritative; use the image only to confirm it.
The SOP lists the intended steps in order, each with the reason it matters. Use the reasons to decide which deviations matter. Work out the trainee's progress yourself from the actions and the machine state; nothing else tracks it for you.
- A harmless change of order (nothing wrong or unsafe results from it) is fine.
- Skipped steps, wrong settings for what comes next, or orders that a step's reason warns against are mistakes.
- Reply with JSON only: {"verdict":"ok"|"correct"|"unsafe","mistakes":[{"stepId":"...","code":"snake_case","explanation":"one sentence"}],"coachingLine":"..."}
- "ok": the trainee is on track, or only exploring harmlessly. Leave coachingLine empty. At a checkpoint, "ok" means they may move on to the next stage.
- "correct": a mistake needs fixing before they continue. At a checkpoint this holds them back. You must then list at least one mistake and give a coachingLine; if you cannot name a concrete mistake, the answer is "ok".
- "unsafe": continuing risks a crash or injury. Use it only when the risk is real.
- coachingLine is spoken aloud: at most 15 words, calm and specific. Say which action was wrong (for example "You pressed Home XY too early") and what to do now. Use spoken control names such as Home Z, Cycle Start or the door, never ids like home_z. Never repeat a correction listed in previousCoaching.
- actionsInOrder is the complete history, oldest first (#1 happened first). Check the order carefully before blaming the trainee: only say a step was too early or skipped if the history really shows it.
- An action "blocked" means the machine's physical interlocks refused it (the reason is in the value). The trainee tried something that cannot work yet. Treat it as a mistake: use "correct", name the step that must come first, and say what to do now in the spoken line.
- In the simulator every control is operated by pointing at it and pressing the trigger. Never describe twisting, pulling, turning or other physical motions; just name the control and what state it should be in.
- Judge the newest action first. If the trainee already moved on, still correct the earlier mistake and name it clearly.
- In test mode do not reveal upcoming steps unless you are correcting a mistake.
- Use the step ids from the SOP in mistakes. Reply with the JSON object and nothing else.`;

function sopLine(s: Step): string {
  const after = s.forbiddenBefore.length > 0 ? ` Normally comes after: ${s.forbiddenBefore.join(', ')}.` : '';
  const cp = s.checkpoint ? ' [checkpoint]' : '';
  const e = s.expectedAction;
  return `${s.id} (stage ${s.stage}) ${s.title}: ${e.control} ${e.action} ${e.value}${cp}. Why: ${s.rationale}${after}`;
}

function actionLine(a: Action): string {
  return `#${a.seq} ${a.control} ${a.action}${a.value ? ' ' + a.value : ''}`;
}

export interface PromptFacts {
  procedure: Procedure;
  earlier: Action[];
  fresh: Action[];
  previousCoaching: string[];
}

export function buildMessages(req: Observe, facts: PromptFacts): ChatMessage[] {
  const state = {
    trigger: req.trigger,
    checkpointId: req.checkpointId ?? null,
    mode: req.mode,
    previousCoaching: facts.previousCoaching,
    machine: req.machine,
    actionsInOrder: [...facts.earlier, ...facts.fresh].map(actionLine),
    newestActions: facts.fresh.map(actionLine),
  };
  const text = `SOP:\n${facts.procedure.steps.map(sopLine).join('\n')}\n\nOBSERVATION:\n${JSON.stringify(state)}`;
  const parts: ContentPart[] = [{ type: 'text', text }];
  if (req.frame) parts.push({ type: 'image_url', image_url: { url: req.frame } });
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: parts },
  ];
}
