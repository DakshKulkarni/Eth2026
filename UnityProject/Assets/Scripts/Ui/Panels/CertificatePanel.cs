using System;
using System.Collections;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class CertificateView
    {
        public string alias;
        public string name;
        public bool valid;
        public string reason;
        public string dates;
        public string verdict;
        public string className;
        public string issuedAt;
        public string evidence;
        public string anchorTx;
        public string issueTx;
        public string recordsTx;
    }

    public class CertificatePanel : MonoBehaviour
    {
        const float Width = 1160f;
        const float Height = 1120f;
        const float RowH = 64f;
        const int Rows = 5;

        UiFactory ui;
        Transform head;
        Canvas canvas;
        RectTransform content;
        UiChip status;
        bool checking;

        public void Init(UiFactory factory, Transform headTransform)
        {
            ui = factory;
            head = headTransform;
        }

        public void Show(CertificateView v, Func<Action<bool, string>, IEnumerator> recheck, Action onClose)
        {
            if (canvas != null) Destroy(canvas.gameObject);
            checking = false;
            float pad = ui.T.padding;
            float inner = Width - 2f * pad;

            var size = new Vector2(Width, Height);
            canvas = ui.WorldCanvas("Certificate", transform, size);
            content = ui.Panel(canvas.transform, "Panel", size, Vector2.zero);
            var col = content.gameObject.AddComponent<BoxCollider>();
            col.size = new Vector3(size.x, size.y, 10f);

            var label = ui.Chip(content, "ENS CERTIFICATE", ui.T.accent, Vector2.zero);
            label.Root.anchoredPosition = new Vector2(-Width * 0.5f + pad + label.Root.sizeDelta.x * 0.5f, 470f);
            status = ui.Chip(content, "", ui.T.success, Vector2.zero);
            SetStatus(v.valid, v.valid ? "VALID" : "NOT VALID");

            string who = string.IsNullOrEmpty(v.alias) ? "Certified operator" : v.alias;
            Fit(ui.Text(content, who, ui.T.hero, ui.T.textPrimary, true, TextAlignmentOptions.Center,
                new Vector2(inner, 96f), new Vector2(0f, 375f)), 40f);
            ui.Text(content, "Certified operator of the cnc-01 vertical machining center", ui.T.caption,
                ui.T.textSecondary, false, TextAlignmentOptions.Center, new Vector2(inner, 44f), new Vector2(0f, 302f));
            Fit(ui.Text(content, v.name, ui.T.title - 8f, ui.T.accent, true, TextAlignmentOptions.Center,
                new Vector2(inner, 64f), new Vector2(0f, 235f)), 28f);
            ui.Text(content, v.dates, ui.T.caption, ui.T.textPrimary, false, TextAlignmentOptions.Center,
                new Vector2(inner, 44f), new Vector2(0f, 178f));

            ui.Fill(ui.Rect(content, "Divider", new Vector2(inner - 40f, 2f), new Vector2(0f, 138f)), ui.T.border);

            ui.Text(content, "ON-CHAIN RECORDS  (key and value, stored on this ENS name)", ui.T.caption - 4f,
                ui.T.textSecondary, true, TextAlignmentOptions.Left, new Vector2(inner, 40f), new Vector2(0f, 102f));

            float cardH = Rows * RowH + 24f;
            var card = ui.Panel(content, "Records", new Vector2(inner, cardH), new Vector2(0f, 70f - cardH * 0.5f), false);
            string[,] rows =
            {
                { "alias", Or(v.alias) },
                { "class", Or(v.className) },
                { "mrt.verdict", Or(v.verdict) },
                { "mrt.issuedAt", Or(v.issuedAt) },
                { "mrt.evidence", Middle(v.evidence, 12, 6) }
            };
            float left = -inner * 0.5f;
            for (int i = 0; i < Rows; i++)
            {
                float y = cardH * 0.5f - 12f - RowH * 0.5f - i * RowH;
                ui.Text(card, rows[i, 0], ui.T.caption, ui.T.accent, true, TextAlignmentOptions.Left,
                    new Vector2(300f, 48f), new Vector2(left + 24f + 150f, y));
                Fit(ui.Text(card, rows[i, 1], ui.T.caption, ui.T.textPrimary, false, TextAlignmentOptions.Left,
                    new Vector2(inner - 380f, 48f), new Vector2(left + 24f + 316f + (inner - 380f) * 0.5f, y)), 20f);
                if (i < Rows - 1)
                    ui.Fill(ui.Rect(card, "Sep", new Vector2(inner - 48f, 2f), new Vector2(0f, y - RowH * 0.5f)), ui.T.border);
            }

            float below = 70f - cardH - 28f;
            ui.Text(content, "0G Chain anchor   " + Middle(v.anchorTx, 12, 6), ui.T.caption - 2f, ui.T.textSecondary, false,
                TextAlignmentOptions.Left, new Vector2(inner, 40f), new Vector2(0f, below));
            ui.Text(content, "ENS issue tx        " + Middle(v.issueTx, 12, 6), ui.T.caption - 2f, ui.T.textSecondary, false,
                TextAlignmentOptions.Left, new Vector2(inner, 40f), new Vector2(0f, below - 46f));
            ui.Text(content, "ENS records tx   " + Middle(v.recordsTx, 12, 6), ui.T.caption - 2f, ui.T.textSecondary, false,
                TextAlignmentOptions.Left, new Vector2(inner, 40f), new Vector2(0f, below - 92f));

            float by = -Height * 0.5f + pad + 38f;
            ui.Button(content, "Check live again", new Vector2(420f, 76f), new Vector2(-230f, by), ui.T.border, () =>
            {
                if (checking || recheck == null) return;
                checking = true;
                SetStatus(v.valid, "CHECKING");
                StartCoroutine(recheck((valid, reason) =>
                {
                    checking = false;
                    SetStatus(valid, valid ? "VALID (live)" : "NOT VALID (" + reason + ")");
                }));
            });
            ui.Button(content, "Close", new Vector2(320f, 76f), new Vector2(180f, by), ui.T.accent, () =>
            {
                Hide();
                if (onClose != null) onClose();
            });

            Place();
            PanelFx.In(this, canvas.GetComponent<CanvasGroup>(), content);
        }

        void SetStatus(bool valid, string text)
        {
            status.Set(text, valid ? ui.T.success : ui.T.danger);
            status.Root.anchoredPosition = new Vector2(Width * 0.5f - ui.T.padding - status.Root.sizeDelta.x * 0.5f, 470f);
        }

        // One line that shrinks to fit its box instead of being cut off.
        static void Fit(TextMeshProUGUI t, float min)
        {
            t.textWrappingMode = TextWrappingModes.NoWrap;
            t.enableAutoSizing = true;
            t.fontSizeMin = min;
            t.fontSizeMax = t.fontSize;
        }

        static string Or(string value)
        {
            return string.IsNullOrEmpty(value) ? "-" : value;
        }

        static string Middle(string value, int head, int tail)
        {
            if (string.IsNullOrEmpty(value)) return "-";
            return value.Length > head + tail + 3 ? value.Substring(0, head) + "..." + value.Substring(value.Length - tail) : value;
        }

        void Hide()
        {
            if (canvas == null) return;
            var go = canvas.gameObject;
            var group = canvas.GetComponent<CanvasGroup>();
            var root = (RectTransform)canvas.transform.GetChild(0);
            canvas = null;
            PanelFx.Out(this, group, root, () => { if (go != null) Destroy(go); });
        }

        void Place()
        {
            Vector3 forward = head.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();
            canvas.transform.position = head.position + forward * 1.05f + Vector3.down * 0.03f;
            canvas.transform.rotation = Quaternion.LookRotation(forward);
        }
    }
}
