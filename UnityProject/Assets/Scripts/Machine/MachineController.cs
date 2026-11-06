using System;
using System.Collections.Generic;
using MrTrainer.Core;
using UnityEngine;

namespace MrTrainer.Machine
{
    public class MachineController : MonoBehaviour
    {
        public MachineControl[] controls;
        public CycleSimulator simulator;

        public MachineState State { get; private set; }

        public event Action<ActionRecord> Accepted;
        public event Action<string, string> Blocked;
        public event Action<string, string, string> BlockedDetail;
        public event Action<string> CycleFinished;

        readonly Dictionary<string, MachineControl> byId = new Dictionary<string, MachineControl>();
        MachineState initial;

        void Awake()
        {
            State = new MachineState();
            initial = State.Clone();
            simulator.Init(State, this);
            foreach (var c in controls)
            {
                byId[c.controlId] = c;
                c.Init(this);
            }
        }

        public MachineControl GetControl(string id)
        {
            MachineControl c;
            return byId.TryGetValue(id, out c) ? c : null;
        }

        public void ResetMachine()
        {
            Restore(initial);
        }

        public MachineState Snapshot()
        {
            return State.Clone();
        }

        public void Restore(MachineState snap)
        {
            simulator.Cancel();
            State.CopyFrom(snap);
            State.Raise();
        }

        public bool TryAct(string id, string value)
        {
            string why = Check(id, value);
            if (why != null)
            {
                State.alarm = why;
                State.alarmTime = Time.time;
                State.Raise();
                if (Blocked != null) Blocked(id, why);
                if (BlockedDetail != null) BlockedDetail(id, value, why);
                return false;
            }
            Apply(id, value);
            State.Raise();
            Emit(id, IsPress(id) ? "press" : "set", value);
            return true;
        }

        public void OnCycleFinished(string kind)
        {
            State.Raise();
            Emit("cycle", "complete", kind);
            if (CycleFinished != null) CycleFinished(kind);
        }

        static bool IsPress(string id)
        {
            return id == ControlIds.HomeZ || id == ControlIds.HomeXY ||
                   id == ControlIds.CycleStart || id == ControlIds.CycleStop;
        }

        void Emit(string control, string action, string value)
        {
            if (Accepted == null) return;
            Accepted(new ActionRecord { t = Time.time, control = control, action = action, value = value ?? "" });
        }

        string Check(string id, string value)
        {
            var s = State;
            switch (id)
            {
                case ControlIds.Power:
                    if (value == "on")
                    {
                        if (s.estop == "engaged") return "Release the E-STOP first";
                        if (s.isolator != "on") return "Main isolator is OFF";
                    }
                    return null;
                case ControlIds.Mode:
                case ControlIds.Tool:
                case ControlIds.Program:
                    if (s.power != "on") return "Power is off";
                    if (s.Running) return "Stop the cycle first";
                    return null;
                case ControlIds.Feed:
                case ControlIds.Coolant:
                    return s.power != "on" ? "Power is off" : null;
                case ControlIds.HomeZ:
                case ControlIds.HomeXY:
                    if (s.power != "on") return "Power is off";
                    if (s.mode != "HOME") return "Select HOME mode first";
                    if (s.Running) return "Cycle is running";
                    if (simulator.Homing) return "Axes are moving";
                    return null;
                case ControlIds.Door:
                    if (value == "open" && s.Running) return "Door locked while cycle runs";
                    return null;
                case ControlIds.Workpiece:
                    if (s.Running) return "Cycle is running";
                    if (s.door != "open") return "Open the door first";
                    return null;
                case ControlIds.Clamp:
                    if (s.Running) return "Cycle is running";
                    if (s.door != "open") return "Open the door first";
                    if (s.workpiece != "placed") return "No workpiece to clamp";
                    return null;
                case ControlIds.CycleStart:
                    if (s.power != "on") return "Power is off";
                    if (s.Running) return "Cycle already running";
                    if (s.door != "closed") return "Close the door first";
                    if (!s.AllHomed) return "Home all axes first";
                    if (s.mode != "AUTO" && s.mode != "DRY") return "Select AUTO or DRY mode";
                    if (string.IsNullOrEmpty(s.program)) return "Select a program";
                    if (s.workpiece != "placed") return "No workpiece loaded";
                    return null;
                case ControlIds.CycleStop:
                    return s.Running ? null : "No cycle is running";
                default:
                    return null;
            }
        }

        void Apply(string id, string value)
        {
            var s = State;
            switch (id)
            {
                case ControlIds.Isolator:
                    s.isolator = value;
                    if (value == "off") PowerDown();
                    break;
                case ControlIds.Estop:
                    s.estop = value;
                    if (value == "engaged") PowerDown();
                    break;
                case ControlIds.Power:
                    s.power = value;
                    if (value == "off") PowerDown();
                    break;
                case ControlIds.Workpiece:
                    s.workpiece = value;
                    if (value == "removed") s.clamped = false;
                    break;
                case ControlIds.HomeZ:
                    simulator.StartHome("z");
                    break;
                case ControlIds.HomeXY:
                    simulator.StartHome("xy");
                    break;
                case ControlIds.CycleStart:
                    simulator.StartCycle(s.mode == "AUTO" ? "auto" : "dry", s.feed);
                    break;
                case ControlIds.CycleStop:
                    simulator.StopCycle();
                    break;
                default:
                    s.Set(id, value);
                    break;
            }
        }

        void PowerDown()
        {
            var s = State;
            s.power = "off";
            s.coolant = false;
            s.homedX = s.homedY = s.homedZ = false;
            simulator.Cancel();
            simulator.StopCycle();
        }
    }
}
