using System;
using System.Collections;
using System.Collections.Generic;
using MrTrainer.Core;

namespace MrTrainer.Guidance
{
    public class CheckpointContext
    {
        public StepDef step;
    }

    public interface ICheckpointService
    {
        IEnumerator Judge(CheckpointContext context, Action<Verdict> done);
    }
}
