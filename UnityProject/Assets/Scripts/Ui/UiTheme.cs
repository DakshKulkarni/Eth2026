using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    [CreateAssetMenu(menuName = "MR Trainer/Ui Theme", fileName = "UiTheme")]
    public class UiTheme : ScriptableObject
    {
        public Color panel = new Color(15f / 255f, 22f / 255f, 32f / 255f, 0.88f);
        public Color border = new Color(42f / 255f, 54f / 255f, 69f / 255f, 1f);
        public Color textPrimary = new Color(242f / 255f, 246f / 255f, 250f / 255f, 1f);
        public Color textSecondary = new Color(159f / 255f, 176f / 255f, 195f / 255f, 1f);
        public Color accent = new Color(76f / 255f, 141f / 255f, 255f / 255f, 1f);
        public Color success = new Color(25f / 255f, 195f / 255f, 166f / 255f, 1f);
        public Color warning = new Color(245f / 255f, 166f / 255f, 35f / 255f, 1f);
        public Color danger = new Color(255f / 255f, 77f / 255f, 79f / 255f, 1f);

        public TMP_FontAsset regular;
        public TMP_FontAsset semibold;

        public float body = 40f;
        public float caption = 32f;
        public float title = 56f;
        public float hero = 72f;
        public float padding = 32f;
        public float gap = 16f;
        public float borderWidth = 3f;
    }
}
