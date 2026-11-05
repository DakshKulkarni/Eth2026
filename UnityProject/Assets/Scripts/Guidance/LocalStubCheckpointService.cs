using System;
using System.Collections;
using MrTrainer.Core;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class LocalStubCheckpointService : ICheckpointService
    {
        int counter;

        public IEnumerator Judge(CheckpointContext context, Action<Verdict> done)
        {
            float start = Time.realtimeSinceStartup;
            yield return new WaitForSeconds(0.7f);

            var v = new Verdict
            {
                requestId = "local-stub-" + (++counter),
                model = "local stub (not 0G)",
                latencyMs = (int)((Time.realtimeSinceStartup - start) * 1000f),
                completedSteps = context.completed
            };

            if (OVRInput.Get(OVRInput.Button.PrimaryIndexTrigger, OVRInput.Controller.LTouch))
            {
                v.verdict = "safe_stop";
                v.coachingLine = "Verification unavailable. Do not continue.";
            }
            else if (context.violations.Count == 0)
            {
                v.verdict = "pass";
                v.coachingLine = "Good work. This stage is complete.";
            }
            else
            {
                v.verdict = "fail";
                foreach (var s in context.violations)
                    v.mistakes.Add(new Mistake { stepId = s.id, code = "order_violation", explanation = s.rationale });
                v.coachingLine = "Stop. " + context.violations[0].title + " was done in the wrong order.";
            }
            done(v);
        }
    }
}
