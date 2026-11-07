using UnityEngine;

namespace MrTrainer.Machine
{
    // The benchtop drill press: a small, easy-to-explain machine with real interlocks.
    // It reuses the controller, state and action plumbing of the CNC so the same AI technician judges it.
    public class DrillController : MachineController
    {
        public const string Hole = "hole";

        public float strokeSeconds = 3.4f;

        // 0 at rest, 1 with the bit at full depth.
        public float Plunge { get; private set; }

        protected override void InitState(MachineState s)
        {
            s.generic = true;
            s.isolator = "off";
            s.estop = "engaged";
            s.workpiece = "removed";
            s.clamped = false;
            s.extra[ControlIds.Guard] = "open";
            s.extra[ControlIds.Bit] = "6mm";
            s.extra[ControlIds.Speed] = "HIGH";
            s.extra[ControlIds.Depth] = "30mm";
            s.extra[ControlIds.Oil] = "off";
            s.extra[ControlIds.Spindle] = "off";
            s.extra[Hole] = "none";
        }

        public bool SpindleOn { get { return State.Get(ControlIds.Spindle) == "on"; } }

        protected override bool IsPress(string id)
        {
            return id == ControlIds.FeedLever;
        }

        protected override string Check(string id, string value)
        {
            var s = State;
            bool spindle = SpindleOn;
            switch (id)
            {
                case ControlIds.Bit:
                case ControlIds.Speed:
                    if (s.isolator != "on") return "Main switch is OFF";
                    if (spindle) return "Stop the motor first";
                    return null;
                case ControlIds.Depth:
                    if (spindle) return "Stop the motor first";
                    return null;
                case ControlIds.Workpiece:
                    if (spindle) return "Stop the motor first";
                    if (s.Get(ControlIds.Guard) != "open") return "Raise the guard first";
                    if (value == "removed" && s.clamped) return "Release the clamp first";
                    return null;
                case ControlIds.Clamp:
                    if (spindle) return "Stop the motor first";
                    if (s.Get(ControlIds.Guard) != "open") return "Raise the guard first";
                    if (s.workpiece != "placed") return "No part to clamp";
                    return null;
                case ControlIds.Guard:
                    if (value == "open" && spindle) return "Stop the motor first";
                    return null;
                case ControlIds.Oil:
                    if (s.isolator != "on") return "Main switch is OFF";
                    return null;
                case ControlIds.Spindle:
                    if (value != "on") return null;
                    if (s.estop == "engaged") return "Release the E-STOP first";
                    if (s.isolator != "on") return "Main switch is OFF";
                    if (s.Get(ControlIds.Guard) != "closed") return "Lower the guard first";
                    if (s.workpiece != "placed" || !s.clamped) return "Clamp the part first";
                    return null;
                case ControlIds.FeedLever:
                    if (s.Running) return "Already drilling";
                    if (!spindle) return "Start the motor first";
                    if (s.Get(ControlIds.Guard) != "closed") return "Lower the guard first";
                    if (s.workpiece != "placed" || !s.clamped) return "No clamped part";
                    if (s.Get(ControlIds.Depth) == "30mm") return "Depth stop too deep: the bit would hit the table";
                    return null;
                default:
                    return null;
            }
        }

        protected override void Apply(string id, string value)
        {
            var s = State;
            switch (id)
            {
                case ControlIds.Isolator:
                    s.isolator = value;
                    if (value == "off") StopMotor();
                    break;
                case ControlIds.Estop:
                    s.estop = value;
                    if (value == "engaged") StopMotor();
                    break;
                case ControlIds.Workpiece:
                    s.workpiece = value;
                    if (value == "removed") s.clamped = false;
                    if (value == "placed") s.extra[Hole] = "none";
                    break;
                case ControlIds.FeedLever:
                    s.cycle = "running";
                    s.cycleKind = "drill";
                    s.cycleT = 0f;
                    break;
                default:
                    s.Set(id, value);
                    break;
            }
        }

        void StopMotor()
        {
            State.extra[ControlIds.Spindle] = "off";
            State.cycle = "idle";
            State.cycleKind = "";
            State.cycleT = 0f;
        }

        void Update()
        {
            var s = State;
            if (s == null) return;
            float dt = Time.deltaTime;
            if (!s.Running)
            {
                Plunge = Mathf.MoveTowards(Plunge, 0f, dt * 2f);
                return;
            }

            s.cycleT += dt / strokeSeconds;
            float t = Mathf.Clamp01(s.cycleT);
            Plunge = Mathf.SmoothStep(0f, 1f, t < 0.5f ? t / 0.5f : (1f - t) / 0.5f);
            if (s.cycleT < 1f) return;

            s.cycle = "idle";
            s.cycleKind = "";
            s.cycleT = 0f;
            s.cycleCount++;
            s.extra[Hole] = s.Get(ControlIds.Depth);
            OnCycleFinished("drill");
        }
    }
}
