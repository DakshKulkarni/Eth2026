using System;
using System.Collections;
using System.Collections.Generic;
using MrTrainer.Core;

namespace MrTrainer.Guidance
{
    public class CheckpointContext
    {
        public CheckpointRequest request;
        public StepDef step;
        public List<StepDef> violations;
        public List<string> completed;
    }

    public interface ICheckpointService
    {
        IEnumerator Judge(CheckpointContext context, Action<Verdict> done);
    }
}
