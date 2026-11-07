using System;
using MrTrainer.Guidance;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class StepCardPanel : MonoBehaviour
    {
        public event Action HintClicked;
        public event Action RecenterClicked;
        public event Action RestartClicked;
        public event Action SwitchClicked;
        public event Action MachineClicked;

        UiFactory ui;
        UiChip modeChip;
        TextMeshProUGUI stageText;
        TextMeshProUGUI instruction;
        TextMeshProUGUI why;
        UiProgressBar progress;
        UiButton hintButton;
        UiButton switchButton;
        RectTransform content;
        CanvasGroup group;
        bool shown;

        public void Build(UiFactory factory, Transform head, Transform hand)
        {
            ui = factory;
            var follow = gameObject.AddComponent<HeadFollow>();
            follow.head = head;
            var size = new Vector2(780f, 460f);
            var canvas = ui.WorldCanvas("Card", transform, size);
            group = canvas.GetComponent<CanvasGroup>();
            group.alpha = 0f;
            content = ui.Panel(canvas.transform, "Panel", size, Vector2.zero);

            modeChip = ui.Chip(content, "LEARN", ui.T.accent, new Vector2(-265f, 175f));
            stageText = ui.Text(content, "", ui.T.caption, ui.T.textSecondary, false, TextAlignmentOptions.Right,
                new Vector2(430f, 44f), new Vector2(145f, 175f));
            instruction = ui.Text(content, "", 46f, ui.T.textPrimary, true, TextAlignmentOptions.TopLeft,
                new Vector2(716f, 132f), new Vector2(0f, 72f));
            instruction.enableAutoSizing = true;
            instruction.fontSizeMin = 34f;
            instruction.fontSizeMax = 46f;
            why = ui.Text(content, "", ui.T.caption, ui.T.textSecondary, false, TextAlignmentOptions.TopLeft,
                new Vector2(716f, 92f), new Vector2(0f, -28f));
            why.enableAutoSizing = true;
            why.fontSizeMin = 22f;
            why.fontSizeMax = ui.T.caption;
            progress = ui.ProgressBar(content, new Vector2(716f, 14f), new Vector2(0f, -96f));

            var neutral = new Color(0.17f, 0.19f, 0.23f, 1f);
            hintButton = ui.Button(content, "Hint", new Vector2(168f, 64f), new Vector2(-272f, -170f), ui.T.warning,
                () => { if (HintClicked != null) HintClicked(); });
            ui.Button(content, "Recenter", new Vector2(168f, 64f), new Vector2(-91f, -170f), neutral,
                () => { if (RecenterClicked != null) RecenterClicked(); });
            ui.Button(content, "Restart", new Vector2(168f, 64f), new Vector2(91f, -170f), neutral,
                () => { if (RestartClicked != null) RestartClicked(); });
            BuildHeader(canvas.transform, follow, neutral);
            switchButton = ui.Button(content, "Test mode", new Vector2(168f, 64f), new Vector2(272f, -170f), ui.T.accent,
                () => { if (SwitchClicked != null) SwitchClicked(); });
        }

        // A row above the card: follow me, a grip to hold and drag, and a button that folds the card away.
        void BuildHeader(Transform root, HeadFollow follow, Color neutral)
        {
            const float y = 338f;
            ui.Button(root, "Follow me", new Vector2(150f, 56f), new Vector2(-265f, y), neutral, () => follow.Unpin());

            var grip = ui.Rect(root, "Grip", new Vector2(200f, 56f), new Vector2(-80f, y));
            var gripBg = ui.Fill(grip, neutral);
            var col = grip.gameObject.AddComponent<BoxCollider>();
            col.size = new Vector3(200f, 56f, 30f);
            var gripText = ui.Text(grip, "Hold to move", ui.T.caption - 2f, ui.T.textSecondary, true,
                TextAlignmentOptions.Center, new Vector2(180f, 56f), Vector2.zero);
            gripText.textWrappingMode = TextWrappingModes.NoWrap;
            gripText.enableAutoSizing = true;
            gripText.fontSizeMin = 20f;
            gripText.fontSizeMax = ui.T.caption - 2f;
            var handle = grip.gameObject.AddComponent<UiDragHandle>();
            handle.Setup(transform, follow, gripBg, gripText, neutral, ui.T.border);

            ui.Button(root, "Machine", new Vector2(150f, 56f), new Vector2(105f, y), neutral,
                () => { if (MachineClicked != null) MachineClicked(); });

            UiButton fold = null;
            fold = ui.Button(root, "Hide card", new Vector2(150f, 56f), new Vector2(265f, y), neutral, () =>
            {
                bool open = !content.gameObject.activeSelf;
                content.gameObject.SetActive(open);
                fold.SetLabel(open ? "Hide card" : "Show card");
            });
        }

        public void ShowStep(ProcedureRunner r, bool hintVisible)
        {
            bool test = r.Mode == TrainingMode.Test;
            var step = r.Current;
            modeChip.Set(test ? "TEST" : "LEARN", test ? ui.T.warning : ui.T.accent);
            stageText.text = "Stage " + (r.StageIndex + 1) + " of " + r.P.stages.Count +
                             "  -  Step " + r.StepNumberInStage + " of " + r.StageSteps.Count;
            if (step != null)
            {
                if (!test)
                {
                    instruction.text = step.spokenInstruction;
                    why.text = "Why: " + step.rationale;
                }
                else if (hintVisible)
                {
                    instruction.text = step.spokenInstruction;
                    why.text = "Hints used: " + r.Hints + " of " + r.P.hintLimit;
                }
                else
                {
                    instruction.text = "Continue the procedure from memory.";
                    why.text = "No highlights in test mode. Hints used: " + r.Hints + " of " + r.P.hintLimit;
                }
            }
            progress.Set(r.TotalDone / (float)r.TotalSteps, test ? ui.T.warning : ui.T.accent);
            hintButton.gameObject.SetActive(test);
            switchButton.SetLabel(test ? "Learn mode" : "Test mode");
            Reveal();
        }

        // Shown between simulations, before a mode is chosen.
        public void ShowIdle(string machineName)
        {
            modeChip.Set("READY", ui.T.accent);
            stageText.text = machineName;
            instruction.text = "Choose Learn or Test mode to begin.";
            why.text = "Learn highlights each control. Test removes the hints.";
            progress.Set(0f, ui.T.accent);
            hintButton.gameObject.SetActive(false);
            Reveal();
        }

        public void SetBusy(string message)
        {
            modeChip.Set("CHECKING", ui.T.accent);
            instruction.text = message;
            why.text = "Please wait.";
        }

        void Reveal()
        {
            if (shown) return;
            shown = true;
            PanelFx.In(this, group, content);
        }
    }
}
