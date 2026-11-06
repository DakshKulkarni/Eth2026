using System;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class NamePadPanel : MonoBehaviour
    {
        const float Width = 1120f;
        const float Height = 660f;
        const float KeyW = 92f;
        const float KeyH = 84f;
        const float KeyGap = 10f;
        const int MaxLen = 12;
        static readonly string[] Rows = { "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM" };

        UiFactory ui;
        Transform head;
        Canvas canvas;
        string typed = "";
        TextMeshProUGUI display;
        UiButton confirm;
        Action<string> finished;

        public void Init(UiFactory factory, Transform headTransform)
        {
            ui = factory;
            head = headTransform;
        }

        public void Show(string title, Action<string> done)
        {
            if (canvas != null) Destroy(canvas.gameObject);
            finished = done;
            typed = "";

            var size = new Vector2(Width, Height);
            canvas = ui.WorldCanvas("NamePad", transform, size);
            var content = ui.Panel(canvas.transform, "Panel", size, Vector2.zero);
            var col = content.gameObject.AddComponent<BoxCollider>();
            col.size = new Vector3(size.x, size.y, 10f);

            float pad = ui.T.padding;
            var chip = ui.Chip(content, "ENS CERTIFICATE", ui.T.accent, Vector2.zero);
            chip.Root.anchoredPosition = new Vector2(-Width * 0.5f + pad + chip.Root.sizeDelta.x * 0.5f, Height * 0.5f - pad - 26f);
            ui.Text(content, title, ui.T.title - 6f, ui.T.textPrimary, true, TextAlignmentOptions.Left,
                new Vector2(Width - 2f * pad, 70f), new Vector2(0f, 215f));
            display = ui.Text(content, "", ui.T.title - 8f, ui.T.accent, true, TextAlignmentOptions.Center,
                new Vector2(Width - 2f * pad, 84f), new Vector2(0f, 128f));

            for (int r = 0; r < Rows.Length; r++)
            {
                string row = Rows[r];
                float x0 = -(row.Length - 1) * (KeyW + KeyGap) * 0.5f;
                float y = 30f - r * (KeyH + KeyGap);
                for (int i = 0; i < row.Length; i++)
                {
                    char letter = row[i];
                    ui.Button(content, letter.ToString(), new Vector2(KeyW, KeyH), new Vector2(x0 + i * (KeyW + KeyGap), y),
                        ui.T.border, () => Type(letter));
                }
            }

            float by = -Height * 0.5f + pad + 38f;
            ui.Button(content, "Delete", new Vector2(250f, 76f), new Vector2(-330f, by), ui.T.warning, Backspace);
            confirm = ui.Button(content, "Skip", new Vector2(330f, 76f), new Vector2(40f, by), ui.T.success, Confirm);

            Refresh();
            Place();
            PanelFx.In(this, canvas.GetComponent<CanvasGroup>(), content);
        }

        void Type(char letter)
        {
            if (typed.Length >= MaxLen) return;
            typed += char.ToLowerInvariant(letter);
            Refresh();
        }

        void Backspace()
        {
            if (typed.Length == 0) return;
            typed = typed.Substring(0, typed.Length - 1);
            Refresh();
        }

        void Refresh()
        {
            display.text = typed.Length == 0
                ? "Tap letters to type your name"
                : typed + "-cert.smartician.eth";
            display.color = typed.Length == 0 ? ui.T.textSecondary : ui.T.accent;
            confirm.SetLabel(typed.Length == 0 ? "Skip" : "Confirm");
        }

        void Confirm()
        {
            var callback = finished;
            string name = typed;
            Hide();
            if (callback != null) callback(name);
        }

        void Hide()
        {
            if (canvas == null) return;
            var go = canvas.gameObject;
            var group = canvas.GetComponent<CanvasGroup>();
            var content = (RectTransform)canvas.transform.GetChild(0);
            canvas = null;
            PanelFx.Out(this, group, content, () => { if (go != null) Destroy(go); });
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
