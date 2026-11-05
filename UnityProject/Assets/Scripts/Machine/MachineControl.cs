using System;
using MrTrainer.Interaction;

namespace MrTrainer.Machine
{
    public enum ControlKind { Toggle, Cycle, Press }

    public class MachineControl : Interactable
    {
        public string controlId;
        public string label;
        public ControlKind kind;
        public string[] values;
        public ControlVisual visual;

        MachineController machine;

        public void Init(MachineController owner)
        {
            machine = owner;
            if (visual != null) visual.Init(owner, controlId);
        }

        public override bool Activate()
        {
            return machine.TryAct(controlId, Next());
        }

        string Next()
        {
            if (kind == ControlKind.Press) return "";
            int i = Array.IndexOf(values, machine.State.Get(controlId));
            return values[(i + 1) % values.Length];
        }

        protected override void OnHover()
        {
            if (visual != null) visual.SetHover(true);
        }

        protected override void OnUnhover()
        {
            if (visual != null) visual.SetHover(false);
        }
    }
}
