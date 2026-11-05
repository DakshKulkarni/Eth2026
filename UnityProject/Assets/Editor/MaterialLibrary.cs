using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace MrTrainer.Editor
{
    public static class MaterialLibrary
    {
        const string Dir = "Assets/Materials/MR";

        public static Material Lit(string name, Color color, float metallic, float smoothness, bool emission = false)
        {
            var m = Load(name, "Universal Render Pipeline/Lit");
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Metallic", metallic);
            m.SetFloat("_Smoothness", smoothness);
            if (emission)
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", Color.black);
            }
            return Save(m);
        }

        public static Material Unlit(string name, Color color)
        {
            var m = Load(name, "Universal Render Pipeline/Unlit");
            m.SetColor("_BaseColor", color);
            return Save(m);
        }

        public static Material Hull(string name, Color color)
        {
            var m = Load(name, "Universal Render Pipeline/Unlit");
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Cull", 1f);
            return Save(m);
        }

        public static Material Transparent(string name, Color color)
        {
            var m = Load(name, "Universal Render Pipeline/Unlit");
            m.SetColor("_BaseColor", color);
            m.SetFloat("_Surface", 1f);
            m.SetFloat("_Blend", 0f);
            m.SetFloat("_ZWrite", 0f);
            m.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
            m.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_SrcBlendAlpha", (float)BlendMode.One);
            m.SetFloat("_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha);
            m.SetOverrideTag("RenderType", "Transparent");
            m.renderQueue = (int)RenderQueue.Transparent;
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.DisableKeyword("_ALPHATEST_ON");
            return Save(m);
        }

        static Material Load(string name, string shaderName)
        {
            Directory.CreateDirectory(Dir);
            string path = Dir + "/" + name + ".mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m != null) return m;
            m = new Material(Shader.Find(shaderName));
            AssetDatabase.CreateAsset(m, path);
            return m;
        }

        static Material Save(Material m)
        {
            EditorUtility.SetDirty(m);
            return m;
        }
    }
}
