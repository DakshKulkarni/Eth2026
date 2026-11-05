using System.Collections.Generic;
using Newtonsoft.Json;

namespace MrTrainer.Core
{
    public class ExpectedAction
    {
        public string control;
        public string action;
        public string value;
    }

    public class StepDef
    {
        public string id;
        public int stage;
        public string title;
        public string spokenInstruction;
        public string rationale;
        public string targetControl;
        public ExpectedAction expectedAction;
        public bool checkpoint;
        public string mode;
        public List<string> forbiddenBefore = new List<string>();
    }

    public class StageDef
    {
        public int id;
        public string title;
    }

    public class Procedure
    {
        public string id;
        public string name;
        public string version;
        public int hintLimit;
        public List<StageDef> stages = new List<StageDef>();
        public List<StepDef> steps = new List<StepDef>();

        public static Procedure Parse(string json)
        {
            return JsonConvert.DeserializeObject<Procedure>(json);
        }

        public List<StepDef> StepsOf(int stage)
        {
            return steps.FindAll(s => s.stage == stage);
        }

        public StepDef Find(string id)
        {
            return steps.Find(s => s.id == id);
        }
    }

    public class ActionRecord
    {
        public float t;
        public string control;
        public string action;
        public string value;
    }

    public class HomedDto
    {
        public bool x;
        public bool y;
        public bool z;
    }

    public class MachineDto
    {
        public string door;
        public string estop;
        public string isolator;
        public string power;
        public string mode;
        public HomedDto homed = new HomedDto();
        public bool clamped;
        public string tool;
        public string program;
        public int feed;
        public bool coolant;
        public string cycle;
    }

    public class CheckpointRequest
    {
        public string checkpointId;
        public MachineDto machine;
        public List<ActionRecord> actions = new List<ActionRecord>();
    }

    public class Mistake
    {
        public string stepId;
        public string code;
        public string explanation;
    }

    public class Verdict
    {
        public string verdict;
        public List<string> completedSteps = new List<string>();
        public List<Mistake> mistakes = new List<Mistake>();
        public string coachingLine;
        public string requestId;
        public string model;
        public int latencyMs;
    }
}
