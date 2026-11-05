using System;
using MrTrainer.Core;

namespace MrTrainer.Machine
{
    public class MachineState
    {
        public string door = "closed";
        public string estop = "engaged";
        public string isolator = "off";
        public string power = "off";
        public string mode = "JOG";
        public string tool = "T3";
        public string program = "";
        public string workpiece = "removed";
        public bool clamped;
        public int feed = 100;
        public bool coolant;
        public bool homedX;
        public bool homedY;
        public bool homedZ;
        public string cycle = "idle";
        public string cycleKind = "";
        public float cycleT;
        public int cycleCount;
        public float axisX = 0.16f;
        public float axisY = -0.09f;
        public float axisZ = -0.22f;
        public string alarm = "";
        public float alarmTime = -100f;

        public event Action Changed;

        public bool Running { get { return cycle == "running"; } }
        public bool AllHomed { get { return homedX && homedY && homedZ; } }

        public void Raise()
        {
            if (Changed != null) Changed();
        }

        public string Get(string control)
        {
            switch (control)
            {
                case ControlIds.Door: return door;
                case ControlIds.Estop: return estop;
                case ControlIds.Isolator: return isolator;
                case ControlIds.Power: return power;
                case ControlIds.Mode: return mode;
                case ControlIds.Tool: return tool;
                case ControlIds.Program: return program;
                case ControlIds.Workpiece: return workpiece;
                case ControlIds.Clamp: return clamped ? "clamped" : "released";
                case ControlIds.Feed: return feed.ToString();
                case ControlIds.Coolant: return coolant ? "on" : "off";
                case ControlIds.HomeZ: return homedZ ? "homed" : "";
                case ControlIds.HomeXY: return homedX && homedY ? "homed" : "";
                case ControlIds.CycleStart: return Running ? "running" : "";
                default: return "";
            }
        }

        public void Set(string control, string value)
        {
            switch (control)
            {
                case ControlIds.Door: door = value; break;
                case ControlIds.Estop: estop = value; break;
                case ControlIds.Isolator: isolator = value; break;
                case ControlIds.Power: power = value; break;
                case ControlIds.Mode: mode = value; break;
                case ControlIds.Tool: tool = value; break;
                case ControlIds.Program: program = value; break;
                case ControlIds.Workpiece: workpiece = value; break;
                case ControlIds.Clamp: clamped = value == "clamped"; break;
                case ControlIds.Feed: feed = int.Parse(value); break;
                case ControlIds.Coolant: coolant = value == "on"; break;
            }
        }

        public void CopyFrom(MachineState o)
        {
            door = o.door; estop = o.estop; isolator = o.isolator; power = o.power;
            mode = o.mode; tool = o.tool; program = o.program; workpiece = o.workpiece;
            clamped = o.clamped; feed = o.feed; coolant = o.coolant;
            homedX = o.homedX; homedY = o.homedY; homedZ = o.homedZ;
            cycle = o.cycle; cycleKind = o.cycleKind; cycleT = o.cycleT; cycleCount = o.cycleCount;
            axisX = o.axisX; axisY = o.axisY; axisZ = o.axisZ;
            alarm = ""; alarmTime = -100f;
        }

        public MachineState Clone()
        {
            var c = new MachineState();
            c.CopyFrom(this);
            return c;
        }

        public MachineDto ToDto()
        {
            return new MachineDto
            {
                door = door,
                estop = estop,
                isolator = isolator,
                power = power,
                mode = mode,
                homed = new HomedDto { x = homedX, y = homedY, z = homedZ },
                clamped = clamped,
                tool = tool,
                program = string.IsNullOrEmpty(program) ? null : program,
                feed = feed,
                coolant = coolant,
                cycle = cycle
            };
        }
    }
}
