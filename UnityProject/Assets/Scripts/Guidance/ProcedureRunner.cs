using System;
using System.Collections.Generic;
using MrTrainer.Core;

namespace MrTrainer.Guidance
{
    public enum TrainingMode { Learn, Test }

    public class ProcedureRunner
    {
        public readonly Procedure P;
        public TrainingMode Mode { get; private set; }
        public int Hints { get; private set; }
        public int Retries { get; private set; }
        public int StageIndex { get; private set; }
        public bool Locked { get; private set; }
        public bool IsFinished { get; private set; }
        public bool Hold { get; set; }

        public event Action StepChanged;
        public event Action<StepDef> CheckpointReached;
        public event Action<int> StageCompleted;
        public event Action Completed;

        HashSet<string> done = new HashSet<string>();
        HashSet<string> safeDone = new HashSet<string>();
        int safeStage;

        public ProcedureRunner(Procedure procedure)
        {
            P = procedure;
        }

        public int StageId { get { return P.stages[StageIndex].id; } }
        public string StageTitle { get { return P.stages[StageIndex].title; } }
        public List<StepDef> StageSteps { get { return P.StepsOf(StageId); } }
        public int TotalSteps { get { return P.steps.Count; } }
        public int TotalDone { get { return done.Count; } }
        public bool TestPassed { get { return Retries == 0 && Hints <= P.hintLimit; } }
        public List<string> CompletedIds { get { return new List<string>(done); } }

        public StepDef Current
        {
            get
            {
                if (IsFinished) return null;
                return StageSteps.Find(s => !done.Contains(s.id));
            }
        }

        public int StepNumberInStage
        {
            get { return StageSteps.FindAll(s => done.Contains(s.id)).Count + 1; }
        }

        public void Start(TrainingMode mode)
        {
            Mode = mode;
            Hints = 0;
            Retries = 0;
            StageIndex = 0;
            Locked = false;
            IsFinished = false;
            done = new HashSet<string>();
            TakeSafePoint();
            RaiseStep();
        }

        public void UseHint()
        {
            Hints++;
        }

        public void OnAction(ActionRecord r)
        {
            if (IsFinished || Locked || Hold) return;
            StepDef hit = StageSteps.Find(s => !done.Contains(s.id) && Matches(s, r));
            if (hit == null) return;

            done.Add(hit.id);

            if (hit.checkpoint)
            {
                Locked = true;
                if (CheckpointReached != null) CheckpointReached(hit);
                return;
            }
            AfterProgress();
        }

        public void ResolveCheckpoint(bool pass)
        {
            Locked = false;
            if (pass)
            {
                TakeSafePoint();
                AfterProgress();
                return;
            }
            Retries++;
            done = new HashSet<string>(safeDone);
            StageIndex = safeStage;
            RaiseStep();
        }

        void AfterProgress()
        {
            if (StageSteps.TrueForAll(s => done.Contains(s.id)))
            {
                int finished = StageId;
                if (StageCompleted != null) StageCompleted(finished);
                StageIndex++;
                TakeSafePoint();
                if (StageIndex >= P.stages.Count)
                {
                    IsFinished = true;
                    StageIndex = P.stages.Count - 1;
                    if (Completed != null) Completed();
                    return;
                }
            }
            RaiseStep();
        }

        void TakeSafePoint()
        {
            safeDone = new HashSet<string>(done);
            safeStage = StageIndex;
        }

        void RaiseStep()
        {
            if (StepChanged != null) StepChanged();
        }

        static bool Matches(StepDef s, ActionRecord r)
        {
            var e = s.expectedAction;
            return e.control == r.control && e.action == r.action &&
                   string.Equals(e.value ?? "", r.value ?? "", StringComparison.OrdinalIgnoreCase);
        }
    }
}
