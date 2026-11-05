using UnityEngine;

namespace MrTrainer.Ui
{
    public static class RoundedSpriteFactory
    {
        const int Size = 64;
        const int Radius = 24;
        static Sprite cached;

        public static Sprite Get()
        {
            if (cached != null) return cached;
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            tex.filterMode = FilterMode.Bilinear;
            tex.wrapMode = TextureWrapMode.Clamp;
            var px = new Color32[Size * Size];
            for (int y = 0; y < Size; y++)
            {
                for (int x = 0; x < Size; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, Radius, Size - Radius);
                    float cy = Mathf.Clamp(y + 0.5f, Radius, Size - Radius);
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
                    byte a = (byte)(Mathf.Clamp01(Radius - d + 0.5f) * 255f);
                    px[y * Size + x] = new Color32(255, 255, 255, a);
                }
            }
            tex.SetPixels32(px);
            tex.Apply();
            cached = Sprite.Create(tex, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), 100f, 0,
                SpriteMeshType.FullRect, new Vector4(Radius, Radius, Radius, Radius));
            return cached;
        }
    }
}
