using System;
using UnityEngine;

namespace MrTrainer.Ui
{
    public static class PanelFx
    {
        public static void In(MonoBehaviour host, CanvasGroup group, Transform content)
        {
            group.alpha = 0f;
            content.localScale = Vector3.one * 0.96f;
            Tween.Run(host, 0.18f, k =>
            {
                group.alpha = k;
                content.localScale = Vector3.one * (0.96f + 0.04f * k);
            });
        }

        public static void Out(MonoBehaviour host, CanvasGroup group, Transform content, Action done)
        {
            Tween.Run(host, 0.18f, k =>
            {
                group.alpha = 1f - k;
                content.localScale = Vector3.one * (1f - 0.04f * k);
            }, Easing.OutCubic, done);
        }
    }
}
