using UnityEngine;

namespace MrTrainer.Machine
{
    // Plain coloured materials for the shapes the drill press scene is built from.
    public static class DrillMaterials
    {
        static Material template;

        // Any material of the project's render pipeline; copies are tinted, so builds keep the right shader.
        public static void SetTemplate(Material material)
        {
            template = material;
        }

        public static Material Make(Color color, float smoothness = 0.35f, float metallic = 0f)
        {
            Material m;
            if (template != null) m = new Material(template);
            else
            {
                var shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null) shader = Shader.Find("Standard");
                m = new Material(shader);
            }
            if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", null);
            if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", null);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
            if (m.HasProperty("_Color")) m.SetColor("_Color", color);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            m.EnableKeyword("_EMISSION");
            if (m.HasProperty("_EmissionColor")) m.SetColor("_EmissionColor", Color.black);
            return m;
        }
    }
}
