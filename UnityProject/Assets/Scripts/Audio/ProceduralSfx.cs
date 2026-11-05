using UnityEngine;

namespace MrTrainer.Audio
{
    public static class ProceduralSfx
    {
        const int Rate = 44100;
        static AudioClip click;
        static AudioClip success;
        static AudioClip error;
        static AudioClip thunk;

        public static AudioClip Click { get { return click != null ? click : click = Make("click", 0.06f, 1900f, 1200f, 0.5f, false); } }
        public static AudioClip Success { get { return success != null ? success : success = Chime("success", 660f, 990f, 0.1f); } }
        public static AudioClip Error { get { return error != null ? error : error = Make("error", 0.28f, 150f, 120f, 0.5f, true); } }
        public static AudioClip Thunk { get { return thunk != null ? thunk : thunk = Make("thunk", 0.14f, 95f, 60f, 0.7f, false); } }

        public static void Play(AudioClip clip, Vector3 position, float volume = 1f)
        {
            AudioSource.PlayClipAtPoint(clip, position, volume);
        }

        static AudioClip Make(string name, float seconds, float f0, float f1, float volume, bool square)
        {
            int n = (int)(Rate * seconds);
            var data = new float[n];
            float phase = 0f;
            for (int i = 0; i < n; i++)
            {
                float k = (float)i / n;
                float f = Mathf.Lerp(f0, f1, k);
                phase += 2f * Mathf.PI * f / Rate;
                float wave = square ? Mathf.Sign(Mathf.Sin(phase)) * 0.6f : Mathf.Sin(phase);
                data[i] = wave * volume * Mathf.Exp(-5f * k);
            }
            return Build(name, data);
        }

        static AudioClip Chime(string name, float a, float b, float each)
        {
            int half = (int)(Rate * each);
            var data = new float[half * 2];
            for (int i = 0; i < data.Length; i++)
            {
                bool second = i >= half;
                float k = (float)(i % half) / half;
                float f = second ? b : a;
                data[i] = Mathf.Sin(2f * Mathf.PI * f * i / Rate) * 0.45f * Mathf.Exp(-4f * k);
            }
            return Build(name, data);
        }

        static AudioClip Build(string name, float[] data)
        {
            var clip = AudioClip.Create(name, data.Length, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
