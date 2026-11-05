using System.Collections;
using MrTrainer.Guidance;
using MrTrainer.Interaction;
using MrTrainer.Machine;
using MrTrainer.Ui;
using UnityEngine;

namespace MrTrainer.Core
{
    public class AppContext : MonoBehaviour
    {
        public OVRCameraRig rig;
        public UiTheme theme;
        public TextAsset procedureJson;
        public MachineController machine;
        public MachineView view;
        public MachinePlacer placer;
        public HighlightService highlight;
        public StepCardPanel stepCard;
        public ModalPanel modal;
        public ToastHost toasts;
        public GuideFlow flow;

        IEnumerator Start()
        {
            Transform head = rig.centerEyeAnchor;
            var ui = new UiFactory(theme);
            var procedure = Procedure.Parse(procedureJson.text);

            view.Init(machine, ui);
            stepCard.Build(ui, head, rig.leftControllerAnchor);
            highlight.Init(machine, head, stepCard.transform, ui);
            toasts.Init(ui, head, machine, stepCard.transform);
            modal.Init(ui, head);
            flow.Init(procedure, machine, highlight, stepCard, modal, toasts, placer,
                new LocalStubCheckpointService(), ui, head);

            yield return new WaitForSeconds(0.6f);
            placer.Recenter();
            flow.ShowWelcome();
        }
    }
}

