using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    [CreateAssetMenu(menuName = "MR Trainer/Ui Theme", fileName = "UiTheme")]
    public class UiTheme : ScriptableObject
    {
        public Color panel = new Color(0.0588f, 0.0667f, 0.0824f, 0.94f);
        public Color border = new Color(0.149f, 0.169f, 0.2f, 1f);
        public Color textPrimary = new Color(0.9608f, 0.9686f, 0.9804f, 1f);
        public Color textSecondary = new Color(0.596f, 0.635f, 0.702f, 1f);
        public Color accent = new Color(0.8314f, 1f, 0.3098f, 1f);
        public Color success = new Color(0.2392f, 0.8627f, 0.5922f, 1f);
        public Color warning = new Color(1f, 0.7098f, 0.2784f, 1f);
        public Color danger = new Color(1f, 0.4196f, 0.4196f, 1f);

        public TMP_FontAsset regular;
        public TMP_FontAsset semibold;

        public float body = 40f;
        public float caption = 32f;
        public float title = 56f;
        public float hero = 72f;
        public float padding = 32f;
        public float gap = 16f;
        public float borderWidth = 2f;
    }
}
