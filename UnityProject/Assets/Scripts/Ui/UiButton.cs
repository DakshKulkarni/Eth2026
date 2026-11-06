using System;
using MrTrainer.Interaction;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace MrTrainer.Ui
{
    public class UiButton : Interactable
    {
        Image bg;
        TextMeshProUGUI label;
        Color baseColor;
        Action onClick;
        bool hover;
        float press;
        bool active = true;

        public void Setup(Image background, TextMeshProUGUI text, Color color, Action click)
        {
            bg = background;
            label = text;
            baseColor = color;
            onClick = click;
            label.color = Readable(color);
        }

        // Dark text on light fills, light text on dark fills.
        static Color Readable(Color fill)
        {
            float lum = 0.2126f * fill.r + 0.7152f * fill.g + 0.0722f * fill.b;
            return lum > 0.5f ? new Color(0.05f, 0.06f, 0.08f, 1f) : Color.white;
        }

        public void SetLabel(string text)
        {
            label.text = text;
        }

        public void SetColor(Color color)
        {
            baseColor = color;
            label.color = Readable(color);
        }

        public void SetActive(bool on)
        {
            active = on;
        }

        protected override void OnHover()
        {
            hover = true;
        }

        protected override void OnUnhover()
        {
            hover = false;
        }

        public override bool Activate()
        {
            if (!active) return false;
            press = 1f;
            if (onClick != null) onClick();
            return true;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            press = Mathf.MoveTowards(press, 0f, dt / 0.12f);
            float target = (hover ? 1.04f : 1f) - 0.08f * press;
            transform.localScale = Vector3.Lerp(transform.localScale, Vector3.one * target, 20f * dt);
            Color c = hover ? Color.Lerp(baseColor, Color.white, 0.22f) : baseColor;
            if (!active) c = new Color(baseColor.r, baseColor.g, baseColor.b, 0.35f);
            bg.color = Color.Lerp(bg.color, c, 20f * dt);
        }
    }
}
