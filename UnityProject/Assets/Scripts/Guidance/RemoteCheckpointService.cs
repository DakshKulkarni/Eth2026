using System;
using System.Collections;
using MrTrainer.Core;

namespace MrTrainer.Guidance
{
    public class RemoteCheckpointService : ICheckpointService
    {
        readonly CoachService coach;

        public RemoteCheckpointService(CoachService service)
        {
            coach = service;
        }

        public IEnumerator Judge(CheckpointContext context, Action<Verdict> done)
        {
            Verdict result = null;
            yield return coach.Judge(context.step.id, v => result = v);
            done(result);
        }
    }
}
