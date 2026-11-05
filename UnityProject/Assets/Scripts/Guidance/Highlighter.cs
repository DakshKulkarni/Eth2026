using System.Collections.Generic;
using MrTrainer.Machine;
using MrTrainer.Ui;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class Highlighter : MonoBehaviour
    {
        readonly List<GameObject> hulls = new List<GameObject>();
        readonly List<Renderer> hullRenderers = new List<Renderer>();
        Renderer[] targetRenderers;
        Transform chevron;
        Transform label;
        LineRenderer line;
        Transform card;
        Color accent;
        MaterialPropertyBlock block;

        public void Show(MachineControl control, Transform cardAnchor, string text, UiFactory ui, Transform head,
            Material hullMaterial, Material chevronMaterial, Material lineMaterial)
        {
            card = cardAnchor;
            accent = ui.T.accent;
            block = new MaterialPropertyBlock();
            targetRenderers = control.GetComponentsInChildren<Renderer>();

            foreach (var mf in control.GetComponentsInChildren<MeshFilter>())
            {
                if (mf.sharedMesh == null || mf.gameObject.name == "_hl") continue;
                var go = new GameObject("_hl", typeof(MeshFilter), typeof(MeshRenderer));
                go.transform.SetParent(mf.transform, false);
                go.transform.localScale = Vector3.one * 1.12f;
                go.GetComponent<MeshFilter>().sharedMesh = mf.sharedMesh;
                var r = go.GetComponent<MeshRenderer>();
                r.sharedMaterial = hullMaterial;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                hulls.Add(go);
                hullRenderers.Add(r);
            }

            var chev = new GameObject("_chevron", typeof(MeshFilter), typeof(MeshRenderer));
            chev.transform.SetParent(transform, false);
            chev.transform.localScale = new Vector3(0.05f, 0.06f, 0.05f);
            chev.GetComponent<MeshFilter>().sharedMesh = Pyramid();
            chev.GetComponent<MeshRenderer>().sharedMaterial = chevronMaterial;
            chevron = chev.transform;

            float w = Mathf.Max(300f, text.Length * 24f + 70f);
            var canvas = ui.WorldCanvas("_label", transform, new Vector2(w, 90f));
            canvas.gameObject.AddComponent<Billboard>().head = head;
            var panel = ui.Panel(canvas.transform, "Panel", new Vector2(w, 90f), Vector2.zero, false);
            ui.Text(panel, text, ui.T.caption, ui.T.textPrimary, true, TMPro.TextAlignmentOptions.Center,
                new Vector2(w - 20f, 80f), Vector2.zero);
            label = canvas.transform;

            line = gameObject.AddComponent<LineRenderer>();
            line.positionCount = 2;
            line.widthMultiplier = 0.003f;
            line.sharedMaterial = lineMaterial;
            line.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        public void Hide()
        {
            foreach (var h in hulls) if (h != null) Destroy(h);
            Destroy(gameObject);
        }

        void Update()
        {
            if (targetRenderers == null || targetRenderers.Length == 0) return;
            Bounds b = targetRenderers[0].bounds;
            for (int i = 1; i < targetRenderers.Length; i++) b.Encapsulate(targetRenderers[i].bounds);

            float t = Time.time;
            float pulse = 0.5f + 0.5f * Mathf.Sin(t * 5f);
            block.SetColor("_BaseColor", Color.Lerp(accent, Color.white, pulse * 0.6f));
            foreach (var r in hullRenderers) if (r != null) r.SetPropertyBlock(block);

            Vector3 top = new Vector3(b.center.x, b.max.y, b.center.z);
            chevron.position = top + Vector3.up * (0.08f + 0.02f * Mathf.Sin(t * 4f));
            chevron.rotation = Quaternion.Euler(0f, t * 90f, 0f);
            label.position = top + Vector3.up * 0.2f;

            if (card != null)
            {
                line.SetPosition(0, card.position + Vector3.up * 0.2f);
                line.SetPosition(1, b.center);
            }
        }

        static Mesh Pyramid()
        {
            var m = new Mesh();
            m.vertices = new[]
            {
                new Vector3(-0.5f, 0.5f, -0.5f), new Vector3(0.5f, 0.5f, -0.5f),
                new Vector3(0.5f, 0.5f, 0.5f), new Vector3(-0.5f, 0.5f, 0.5f),
                new Vector3(0f, -0.5f, 0f)
            };
            m.triangles = new[] { 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 2, 1, 0, 3, 2 };
            m.RecalculateNormals();
            m.RecalculateBounds();
            return m;
        }
    }
}
