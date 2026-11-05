using System.Collections.Generic;
using MrTrainer.Core;
using MrTrainer.Machine;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class ActionRecorder
    {
        readonly List<ActionRecord> actions = new List<ActionRecord>();
        float start;

        public void Reset()
        {
            actions.Clear();
            start = Time.time;
        }

        public void Clear()
        {
            actions.Clear();
        }

        public void Add(ActionRecord r)
        {
            actions.Add(new ActionRecord
            {
                t = Mathf.Round((r.t - start) * 10f) / 10f,
                control = r.control,
                action = r.action,
                value = r.value
            });
        }

        public CheckpointRequest Build(string checkpointId, MachineState state)
        {
            return new CheckpointRequest
            {
                checkpointId = checkpointId,
                machine = state.ToDto(),
                actions = new List<ActionRecord>(actions)
            };
        }
    }
}
