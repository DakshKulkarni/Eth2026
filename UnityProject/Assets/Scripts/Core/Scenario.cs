using MrTrainer.Machine;
using UnityEngine;

namespace MrTrainer.Core
{
    // One training simulation: a machine, its procedure and where it stands in the room.
    public class Scenario
    {
        public string id;
        public string title;
        public string subtitle;
        public string machineName;
        // The ENS name of the machine passport, or null when this machine has none.
        public string passportLabel;
        public string[] tips = new string[0];
        public Procedure procedure;
        public MachineController machine;
        public MachinePlacer placer;
        public GameObject root;
    }
}
