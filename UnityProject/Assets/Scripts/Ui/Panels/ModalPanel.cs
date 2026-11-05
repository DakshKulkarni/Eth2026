using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class ModalButton
    {
        public string label;
        public Color color;
        public Action click;
    }

    public class TrustInfo
    {
        public string model;
        public string requestId;
        public int latencyMs;
        public string verdict;
        public bool verifiedByZeroG;
    }

    public class ModalSpec
    {
        public string title;
        public string body;
        public string chip;
        public Color accent;
        public List<string> bullets = new List<string>();
        public TrustInfo trust;
        public List<ModalButton> buttons = new List<ModalButton>();
    }

    public class ModalPanel : MonoBehaviour
    {
        const float Width = 860f;
        const float TrustHeight = 176f;

        UiFactory ui;
        Transform head;
        Canvas canvas;

        public void Init(UiFactory factory, Transform headTransform)
        {
            ui = factory;
            head = headTransform;
        }

        public void Hide()
        {
            if (canvas == null) return;
            var go = canvas.gameObject;
            var group = canvas.GetComponent<CanvasGroup>();
            var content = (RectTransform)canvas.transform.GetChild(0);
            canvas = null;
            PanelFx.Out(this, group, content, () => { if (go != null) Destroy(go); });
        }

        public void Show(ModalSpec s)
        {
            if (canvas != null) Destroy(canvas.gameObject);
            float pad = ui.T.padding;
            float gap = ui.T.gap;
            float inner = Width - 2f * pad;
            float bodyH = EstimateHeight(s.body, inner);
            float total = pad + 52f + gap + 76f;
            if (bodyH > 0f) total += gap + bodyH;
            var bulletH = new List<float>();
            foreach (var b in s.bullets)
            {
                float h = EstimateHeight(b, inner);
                bulletH.Add(h);
                total += gap + h;
            }
            if (s.trust != null) total += gap + TrustHeight;
            total += gap + 72f + pad;

            var size = new Vector2(Width, total);
            canvas = ui.WorldCanvas("Modal", transform, size);
            var content = ui.Panel(canvas.transform, "Panel", size, Vector2.zero);
            var col = content.gameObject.AddComponent<BoxCollider>();
            col.size = new Vector3(size.x, size.y, 10f);

            float y = pad;
            var chip = ui.Chip(content, s.chip, s.accent, Vector2.zero);
            chip.Root.anchoredPosition = new Vector2(-Width * 0.5f + pad + chip.Root.sizeDelta.x * 0.5f, Center(total, ref y, 52f, gap));
            ui.Text(content, s.title, ui.T.title, ui.T.textPrimary, true, TextAlignmentOptions.Left,
                new Vector2(inner, 76f), new Vector2(0f, Center(total, ref y, 76f, gap)));
            if (bodyH > 0f)
                ui.Text(content, s.body, ui.T.caption + 4f, ui.T.textPrimary, false, TextAlignmentOptions.TopLeft,
                    new Vector2(inner, bodyH), new Vector2(0f, Center(total, ref y, bodyH, gap)));
            for (int i = 0; i < s.bullets.Count; i++)
                ui.Text(content, "- " + s.bullets[i], ui.T.caption, s.accent, false, TextAlignmentOptions.TopLeft,
                    new Vector2(inner, bulletH[i]), new Vector2(0f, Center(total, ref y, bulletH[i], gap)));
            if (s.trust != null) BuildTrust(content, s.trust, inner, Center(total, ref y, TrustHeight, gap));
            BuildButtons(content, s.buttons, inner, Center(total, ref y, 72f, gap));

            Place();
            PanelFx.In(this, canvas.GetComponent<CanvasGroup>(), content);
        }

        static float Center(float total, ref float y, float h, float gap)
        {
            float cy = total * 0.5f - y - h * 0.5f;
            y += h + gap;
            return cy;
        }

        static float EstimateHeight(string text, float width)
        {
            if (string.IsNullOrEmpty(text)) return 0f;
            int perLine = Mathf.Max(10, (int)(width / 17.5f));
            int lines = Mathf.CeilToInt(text.Length / (float)perLine);
            return lines * 46f + 8f;
        }

        void BuildTrust(RectTransform parent, TrustInfo t, float width, float cy)
        {
            var card = ui.Panel(parent, "Trust", new Vector2(width, TrustHeight), new Vector2(0f, cy), false);
            string id = t.requestId.Length > 16 ? t.requestId.Substring(0, 12) + "..." : t.requestId;
            var box = new Vector2(width - 48f, 36f);
            var left = TextAlignmentOptions.Left;
            ui.Text(card, "Model: " + t.model, ui.T.caption, ui.T.textPrimary, false, left, box, new Vector2(0f, 57f));
            ui.Text(card, "Request: " + id + "   Latency: " + t.latencyMs + " ms", ui.T.caption, ui.T.textPrimary, false, left, box, new Vector2(0f, 19f));
            ui.Text(card, "Verdict: " + t.verdict.ToUpperInvariant(), ui.T.caption, ui.T.textPrimary, true, left, box, new Vector2(0f, -19f));
            ui.Text(card, t.verifiedByZeroG ? "Verified by 0G" : "LOCAL STUB - not verified by 0G", ui.T.caption,
                t.verifiedByZeroG ? ui.T.success : ui.T.warning, true, left, box, new Vector2(0f, -57f));
        }

        void BuildButtons(RectTransform parent, List<ModalButton> buttons, float inner, float cy)
        {
            int n = buttons.Count;
            if (n == 0) return;
            float w = Mathf.Min(380f, (inner - (n - 1) * ui.T.gap) / n);
            float x0 = -(n - 1) * (w + ui.T.gap) * 0.5f;
            for (int i = 0; i < n; i++)
            {
                var b = buttons[i];
                ui.Button(parent, b.label, new Vector2(w, 72f), new Vector2(x0 + i * (w + ui.T.gap), cy), b.color, b.click);
            }
        }

        void Place()
        {
            Vector3 forward = head.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();
            canvas.transform.position = head.position + forward * 0.85f + Vector3.down * 0.05f;
            canvas.transform.rotation = Quaternion.LookRotation(forward);
        }
    }
}
