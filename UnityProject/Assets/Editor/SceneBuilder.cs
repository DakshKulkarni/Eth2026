using System.IO;
using MrTrainer.Core;
using MrTrainer.Guidance;
using MrTrainer.Interaction;
using MrTrainer.Ui;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace MrTrainer.Editor
{
    public static class SceneBuilder
    {
        const string ShellPath = "Assets/CNC_Machining_Center_.glb";
        const string ThemePath = "Assets/UI/UiTheme.asset";

        [MenuItem("Tools/MR Trainer/Build Scene")]
        public static void Build()
        {
            var rig = Object.FindFirstObjectByType<OVRCameraRig>();
            if (rig == null)
            {
                Debug.LogError("MR Trainer: add the Camera Rig building block to the scene first.");
                return;
            }
            var shell = AssetDatabase.LoadAssetAtPath<GameObject>(ShellPath);
            if (shell == null)
            {
                Debug.LogError("MR Trainer: missing " + ShellPath);
                return;
            }
            if (TMP_Settings.instance == null)
            {
                Debug.LogError("MR Trainer: import TMP Essential Resources (Window > TextMeshPro > Import TMP Essential Resources), then build again.");
                return;
            }

            var old = GameObject.Find("MR_Trainer");
            if (old != null) Object.DestroyImmediate(old);
            var root = new GameObject("MR_Trainer");

            var materials = new MachineMaterials();
            var machine = MachineBuilder.Build(root.transform, shell, materials);
            machine.placer.rig = rig;

            var sys = new GameObject("Systems");
            sys.transform.SetParent(root.transform, false);
            var context = sys.AddComponent<AppContext>();
            context.rig = rig;
            context.theme = Theme();
            context.procedureJson = CopyProcedure();
            context.machine = machine.controller;
            context.view = machine.view;
            context.placer = machine.placer;

            var accent = context.theme.accent;
            context.highlight = sys.AddComponent<HighlightService>();
            context.highlight.hullMaterial = MaterialLibrary.Hull("HighlightHull", accent);
            context.highlight.chevronMaterial = MaterialLibrary.Unlit("HighlightChevron", accent);
            context.highlight.lineMaterial = MaterialLibrary.Unlit("HighlightLine", new Color(0.6f, 0.8f, 1f));
            context.toasts = sys.AddComponent<ToastHost>();
            context.modal = sys.AddComponent<ModalPanel>();
            context.flow = sys.AddComponent<GuideFlow>();

            var card = new GameObject("StepCard");
            card.transform.SetParent(root.transform, false);
            context.stepCard = card.AddComponent<StepCardPanel>();

            BuildRay(root.transform, rig, accent);

            AssetDatabase.SaveAssets();
            EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
            Selection.activeGameObject = root;
            Debug.Log("MR Trainer: scene built. Save the scene, then Build and Run.");
        }

        static void BuildRay(Transform parent, OVRCameraRig rig, Color accent)
        {
            var go = new GameObject("ControlRay");
            go.transform.SetParent(parent, false);
            var line = go.AddComponent<LineRenderer>();
            line.positionCount = 2;
            line.widthMultiplier = 0.004f;
            line.useWorldSpace = true;
            line.shadowCastingMode = ShadowCastingMode.Off;

            var cursor = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            cursor.name = "Cursor";
            cursor.transform.SetParent(go.transform, false);
            cursor.transform.localScale = Vector3.one * 0.015f;
            Object.DestroyImmediate(cursor.GetComponent<Collider>());
            var cursorRenderer = cursor.GetComponent<Renderer>();
            cursorRenderer.sharedMaterial = MaterialLibrary.Unlit("RayCursor", accent);
            cursorRenderer.shadowCastingMode = ShadowCastingMode.Off;

            var ray = go.AddComponent<ControlRay>();
            ray.rig = rig;
            ray.line = line;
            ray.cursor = cursor.transform;
            ray.idleMaterial = MaterialLibrary.Unlit("RayIdle", new Color(1f, 1f, 1f, 1f));
            ray.hitMaterial = MaterialLibrary.Unlit("RayHit", accent);
        }

        static UiTheme Theme()
        {
            var theme = AssetDatabase.LoadAssetAtPath<UiTheme>(ThemePath);
            if (theme == null)
            {
                Directory.CreateDirectory("Assets/UI");
                theme = ScriptableObject.CreateInstance<UiTheme>();
                AssetDatabase.CreateAsset(theme, ThemePath);
            }
            foreach (var guid in AssetDatabase.FindAssets("t:TMP_FontAsset"))
            {
                var font = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (font == null) continue;
                string n = font.name.ToLowerInvariant();
                if (theme.semibold == null && (n.Contains("semibold") || n.Contains("bold"))) theme.semibold = font;
                else if (theme.regular == null && n.Contains("regular")) theme.regular = font;
            }
            if (theme.regular == null)
                Debug.LogWarning("MR Trainer: no Regular TMP font asset found (create one from Inter or IBM Plex Sans). Using the TMP default font.");
            EditorUtility.SetDirty(theme);
            return theme;
        }

        static TextAsset CopyProcedure()
        {
            const string target = "Assets/Data/cnc-vmc.json";
            Directory.CreateDirectory("Assets/Data");
            File.Copy(Path.GetFullPath("../procedure/cnc-vmc.json"), target, true);
            AssetDatabase.ImportAsset(target);
            return AssetDatabase.LoadAssetAtPath<TextAsset>(target);
        }
    }
}
