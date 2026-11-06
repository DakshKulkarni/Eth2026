using System.Collections;
using MrTrainer.Core;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class CoachBanner : MonoBehaviour
    {
        UiFactory ui;
        CanvasGroup group;
        RectTransform content;
        UiChip chip;
        TextMeshProUGUI line;
        TextMeshProUGUI caption;
        Coroutine hideRoutine;
        bool visible;
        CanvasGroup statusGroup;
        UiChip statusChip;

        public void SetChecking(bool on)
        {
            if (statusGroup == null) return;
            statusChip.Set(on ? "0G CHECKING" : "0G ONLINE", on ? ui.T.accent : ui.T.success);
            statusGroup.alpha = 1f;
        }

        public void Build(UiFactory factory, Transform cardRoot)
        {
            ui = factory;
            var statusCanvas = ui.WorldCanvas("CoachStatus", cardRoot, new Vector2(380f, 64f));
            statusCanvas.transform.localPosition = new Vector3(-0.2f, 0.27f, 0f);
            statusGroup = statusCanvas.GetComponent<CanvasGroup>();
            statusGroup.alpha = 0f;
            statusChip = ui.Chip(statusCanvas.transform, "0G ONLINE", ui.T.success, Vector2.zero);
            var size = new Vector2(780f, 210f);
            var canvas = ui.WorldCanvas("CoachBanner", cardRoot, size);
            canvas.transform.localPosition = new Vector3(0f, -0.365f, 0f);
            group = canvas.GetComponent<CanvasGroup>();
            group.alpha = 0f;
            content = ui.Panel(canvas.transform, "Panel", size, Vector2.zero);
            chip = ui.Chip(content, "0G COACH", ui.T.warning, new Vector2(-270f, 75f));
            line = ui.Text(content, "", 34f, ui.T.textPrimary, true, TextAlignmentOptions.TopLeft,
                new Vector2(716f, 110f), new Vector2(0f, 6f));
            line.enableAutoSizing = true;
            line.fontSizeMin = 30f;
            line.fontSizeMax = 36f;
            caption = ui.Text(content, "", ui.T.caption, ui.T.textSecondary, false, TextAlignmentOptions.Left,
                new Vector2(716f, 40f), new Vector2(0f, -80f));
            caption.enableAutoSizing = true;
            caption.fontSizeMin = 26f;
            caption.fontSizeMax = 32f;
        }

        public void Show(Verdict v, string about)
        {
            bool danger = v.verdict == "unsafe" || v.verdict == "safe_stop";
            chip.Set(v.verdict == "safe_stop" ? "OFFLINE" : "0G COACH", danger ? ui.T.danger : ui.T.warning);
            line.text = v.coachingLine;
            string id = string.IsNullOrEmpty(v.requestId) ? "-" : (v.requestId.Length > 8 ? v.requestId.Substring(0, 8) : v.requestId);
            caption.text = about + "  -  0G " + id + "  -  " + (v.latencyMs / 1000f).ToString("0.0") + " s";
            Reveal();
            if (hideRoutine != null) StopCoroutine(hideRoutine);
            hideRoutine = StartCoroutine(HideAfter(25f));
        }

        public void Hide()
        {
            if (!visible) return;
            visible = false;
            if (hideRoutine != null) StopCoroutine(hideRoutine);
            PanelFx.Out(this, group, content, null);
        }

        void Reveal()
        {
            if (visible) return;
            visible = true;
            PanelFx.In(this, group, content);
        }

        IEnumerator HideAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            Hide();
        }
    }
}
