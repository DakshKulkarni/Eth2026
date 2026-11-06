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
        public CoachService coach;
        public FrameCapture frames;
        public CoachBanner banner;
        public bool sendFrames = true;

        void Awake()
        {
            if (coach == null) coach = gameObject.AddComponent<CoachService>();
            if (frames == null) frames = gameObject.AddComponent<FrameCapture>();
            if (banner == null) banner = gameObject.AddComponent<CoachBanner>();
        }

        IEnumerator Start()
        {
            Transform head = rig.centerEyeAnchor;
            if (OVRManager.instance != null) OVRManager.instance.trackingOriginType = OVRManager.TrackingOrigin.FloorLevel;
            var ui = new UiFactory(theme);
            var procedure = Procedure.Parse(procedureJson.text);

            view.Init(machine, ui);
            stepCard.Build(ui, head, rig.leftControllerAnchor);
            highlight.Init(machine, head, stepCard.transform, ui);
            toasts.Init(ui, head, machine, stepCard.transform);
            modal.Init(ui, head);
            banner.Build(ui, stepCard.transform);
            frames.Init(head);
            coach.sendFrames = sendFrames;
            coach.Init(new ApiClient(Config.BackendUrl), machine, frames, head);

            flow.Init(procedure, machine, highlight, stepCard, modal, toasts, placer,
                new RemoteCheckpointService(coach), ui, head, coach, banner);

            yield return new WaitForSeconds(0.6f);
            placer.Recenter();
            flow.ShowWelcome();
        }
    }
}

