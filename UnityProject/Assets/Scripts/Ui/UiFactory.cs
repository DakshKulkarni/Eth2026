using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace MrTrainer.Ui
{
    public class UiFactory
    {
        public readonly UiTheme T;

        public UiFactory(UiTheme theme)
        {
            T = theme;
        }

        public Canvas WorldCanvas(string name, Transform parent, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Canvas), typeof(CanvasGroup));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = size;
            rt.localScale = Vector3.one * 0.001f;
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            return canvas;
        }

        public RectTransform Rect(Transform parent, string name, Vector2 size, Vector2 pos)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
            return rt;
        }

        public Image Fill(RectTransform rt, Color color)
        {
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = RoundedSpriteFactory.Get();
            im.type = Image.Type.Sliced;
            im.color = color;
            im.raycastTarget = false;
            return im;
        }

        public RectTransform Panel(Transform parent, string name, Vector2 size, Vector2 pos, bool shadow = true)
        {
            var root = Rect(parent, name, size, pos);
            if (shadow) Fill(Rect(root, "Shadow", size + new Vector2(28f, 28f), new Vector2(0f, -12f)), new Color(0f, 0f, 0f, 0.35f));
            Fill(Rect(root, "Border", size, Vector2.zero), T.border);
            float b = T.borderWidth * 2f;
            Fill(Rect(root, "Fill", size - new Vector2(b, b), Vector2.zero), T.panel);
            return root;
        }

        public TextMeshProUGUI Text(Transform parent, string text, float size, Color color, bool bold,
            TextAlignmentOptions align, Vector2 box, Vector2 pos)
        {
            var rt = Rect(parent, "Text", box, pos);
            var t = rt.gameObject.AddComponent<TextMeshProUGUI>();
            var font = bold && T.semibold != null ? T.semibold : T.regular;
            if (font != null) t.font = font;
            else if (bold) t.fontStyle = FontStyles.Bold;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.textWrappingMode = TextWrappingModes.Normal;
            t.overflowMode = TextOverflowModes.Ellipsis;
            t.raycastTarget = false;
            return t;
        }

        public TextMeshProUGUI Title(Transform parent, string text, Vector2 box, Vector2 pos)
        {
            return Text(parent, text, T.title, T.textPrimary, true, TextAlignmentOptions.Left, box, pos);
        }

        public TextMeshProUGUI Body(Transform parent, string text, Vector2 box, Vector2 pos)
        {
            return Text(parent, text, T.body, T.textPrimary, false, TextAlignmentOptions.Left, box, pos);
        }

        public TextMeshProUGUI Caption(Transform parent, string text, Vector2 box, Vector2 pos)
        {
            return Text(parent, text, T.caption, T.textSecondary, false, TextAlignmentOptions.Left, box, pos);
        }

        public UiChip Chip(Transform parent, string text, Color color, Vector2 pos)
        {
            var chip = new UiChip(this, Rect(parent, "Chip", new Vector2(160f, 52f), pos));
            chip.Set(text, color);
            return chip;
        }

        public UiProgressBar ProgressBar(Transform parent, Vector2 size, Vector2 pos)
        {
            return new UiProgressBar(this, Rect(parent, "ProgressBar", size, pos));
        }

        public UiButton Button(Transform parent, string label, Vector2 size, Vector2 pos, Color color, Action onClick)
        {
            var rt = Rect(parent, "Button_" + label, size, pos);
            var bg = Fill(rt, color);
            var col = rt.gameObject.AddComponent<BoxCollider>();
            col.size = new Vector3(size.x, size.y, 30f);
            var txt = Text(rt, label, T.caption + 4f, T.textPrimary, true, TextAlignmentOptions.Center, size, Vector2.zero);
            var button = rt.gameObject.AddComponent<UiButton>();
            button.Setup(bg, txt, color, onClick);
            return button;
        }
    }
}
