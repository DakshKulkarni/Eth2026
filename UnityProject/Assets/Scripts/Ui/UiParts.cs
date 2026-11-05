using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace MrTrainer.Ui
{
    public class UiChip
    {
        public readonly RectTransform Root;
        readonly Image bg;
        readonly TextMeshProUGUI text;

        public UiChip(UiFactory f, RectTransform root)
        {
            Root = root;
            bg = f.Fill(Root, Color.white);
            text = f.Text(Root, "", f.T.caption, Color.white, true, TextAlignmentOptions.Center, root.sizeDelta, Vector2.zero);
        }

        public void Set(string label, Color color)
        {
            float w = Mathf.Max(120f, label.Length * 20f + 56f);
            Root.sizeDelta = new Vector2(w, Root.sizeDelta.y);
            ((RectTransform)text.transform).sizeDelta = Root.sizeDelta;
            text.text = label;
            text.color = color;
            bg.color = new Color(color.r, color.g, color.b, 0.22f);
        }
    }

    public class UiProgressBar
    {
        readonly RectTransform fill;
        readonly Image fillImage;
        readonly float width;

        public UiProgressBar(UiFactory f, RectTransform root)
        {
            width = root.sizeDelta.x;
            f.Fill(root, f.T.border);
            fill = f.Rect(root, "Fill", new Vector2(0f, root.sizeDelta.y), new Vector2(-width * 0.5f, 0f));
            fill.pivot = new Vector2(0f, 0.5f);
            fillImage = f.Fill(fill, f.T.accent);
        }

        public void Set(float value, Color color)
        {
            float w = Mathf.Max(fill.sizeDelta.y, width * Mathf.Clamp01(value));
            fill.sizeDelta = new Vector2(w, fill.sizeDelta.y);
            fillImage.color = color;
        }
    }
}
