using MrTrainer.Machine;
using MrTrainer.Ui;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class HighlightService : MonoBehaviour
    {
        public Material hullMaterial;
        public Material chevronMaterial;
        public Material lineMaterial;

        MachineController machine;
        Transform head;
        Transform cardAnchor;
        UiFactory ui;
        Highlighter active;

        public bool Enabled { get; set; }

        public void Init(MachineController controller, Transform headTransform, Transform card, UiFactory factory)
        {
            machine = controller;
            head = headTransform;
            cardAnchor = card;
            ui = factory;
            Enabled = true;
        }

        public void SetMachine(MachineController controller)
        {
            Clear();
            machine = controller;
        }

        public void SetTarget(string controlId, string label)
        {
            Clear();
            if (!Enabled) return;
            var control = machine.GetControl(controlId);
            if (control == null) return;
            var go = new GameObject("_highlighter");
            go.transform.SetParent(transform, false);
            active = go.AddComponent<Highlighter>();
            active.Show(control, cardAnchor, label, ui, head, hullMaterial, chevronMaterial, lineMaterial);
        }

        public void Clear()
        {
            if (active == null) return;
            active.Hide();
            active = null;
        }
    }
}
