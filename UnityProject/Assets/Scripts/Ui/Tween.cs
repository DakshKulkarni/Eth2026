using System;
using System.Collections;
using UnityEngine;

namespace MrTrainer.Ui
{
    public static class Easing
    {
        public static float OutCubic(float t)
        {
            return 1f - Mathf.Pow(1f - t, 3f);
        }

        public static float InOutCubic(float t)
        {
            return t < 0.5f ? 4f * t * t * t : 1f - Mathf.Pow(-2f * t + 2f, 3f) / 2f;
        }
    }

    public static class Tween
    {
        public static Coroutine Run(MonoBehaviour host, float seconds, Action<float> step,
            Func<float, float> ease = null, Action done = null)
        {
            return host.StartCoroutine(Co(seconds, step, ease ?? Easing.OutCubic, done));
        }

        static IEnumerator Co(float seconds, Action<float> step, Func<float, float> ease, Action done)
        {
            float t = 0f;
            while (t < seconds)
            {
                t += Time.unscaledDeltaTime;
                step(ease(Mathf.Clamp01(t / seconds)));
                yield return null;
            }
            step(ease(1f));
            if (done != null) done();
        }
    }
}
