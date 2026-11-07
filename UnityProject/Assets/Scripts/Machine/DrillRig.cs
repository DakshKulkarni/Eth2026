using System.Collections.Generic;
using MrTrainer.Core;
using MrTrainer.Ui;
using TMPro;
using UnityEngine;

namespace MrTrainer.Machine
{
    // Builds the drill press simulation in code: the imported drill model on a workbench, plus simple
    // shapes for everything the trainee operates, so one script sets up the whole scene.
    public static class DrillRig
    {
        const string ModelPath = "Models/benchtop_drill_press_";
        const string ProcedurePath = "Procedures/drill-press";

        // Size of the model on the bench, and its turn. If the table faces away from you, change ModelYaw by 180.
        const float M = 1.5f;
        const float ModelYaw = 180f;
        const float BenchTop = 0.78f;

        // The model's own measurements (metres, before scaling): the bit axis and the heights of its parts.
        const float AxisZ = 0.11f;
        const float ChuckBottom = 0.31f;
        const float TableTop = 0.27f;
        const float HeadMid = 0.46f;

        static readonly Color Steel = new Color(0.62f, 0.64f, 0.68f);
        static readonly Color PanelColor = new Color(0.10f, 0.115f, 0.14f);
        static readonly Color Yellow = new Color(1f, 0.71f, 0.28f);

        public static Scenario Create(UiFactory ui, OVRCameraRig rig, Material template)
        {
            DrillMaterials.SetTemplate(template);
            var procedureAsset = Resources.Load<TextAsset>(ProcedurePath);
            if (procedureAsset == null)
            {
                Debug.LogError("Drill press procedure not found at Resources/" + ProcedurePath);
                return null;
            }

            var root = new GameObject("DrillPressScenario");
            var drill = root.AddComponent<DrillController>();
            var view = root.AddComponent<DrillView>();
            view.drill = drill;
            var controls = new List<MachineControl>();

            BuildBench(root.transform);
            BuildMachineBody(root.transform);
            BuildWorkArea(root.transform, ui, view, controls);
            BuildPanel(root.transform, ui, view, controls);
            BuildLever(root.transform, view, controls);
            BuildGuard(root.transform, controls);

            drill.Register(controls.ToArray());

            var placer = root.AddComponent<MachinePlacer>();
            placer.machineRoot = root.transform;
            placer.rig = rig;
            placer.distance = 1.45f;
            placer.focusLocal = new Vector3(0f, 0f, 0.2f);

            root.SetActive(false);
            return new Scenario
            {
                id = "drill-press",
                title = "Drill press",
                subtitle = "13 steps: set up, clamp and drill a hole",
                machineName = "Benchtop drill press",
                passportLabel = null,
                tips = new[]
                {
                    "A small machine with real safety rules",
                    "Big bit means slow speed. Clamp the part. Guard down before the motor.",
                    "Same AI technician, same proof on 0G and ENS"
                },
                procedure = Procedure.Parse(procedureAsset.text),
                machine = drill,
                placer = placer,
                root = root
            };
        }

        // ---- shapes -------------------------------------------------------------------------------

        static Vector3 G(float gx, float gy, float gz)
        {
            // Model coordinates to the scenario's: the model faces +z towards the trainee and is mirrored in x.
            return new Vector3(-gx * M, BenchTop + gy * M, gz * M);
        }

        static GameObject Prim(PrimitiveType type, string name, Transform parent, Vector3 pos, Vector3 scale, Color color,
            float smooth = 0.35f, float metal = 0f)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            var col = go.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = DrillMaterials.Make(color, smooth, metal);
            return go;
        }

        static void BuildBench(Transform root)
        {
            Prim(PrimitiveType.Cube, "Bench", root, new Vector3(0f, BenchTop * 0.5f, 0.1f), new Vector3(1.05f, BenchTop, 1.2f),
                new Color(0.42f, 0.34f, 0.26f), 0.2f);
            Prim(PrimitiveType.Cube, "BenchTop", root, new Vector3(0f, BenchTop - 0.01f, 0.1f), new Vector3(1.08f, 0.03f, 1.23f),
                new Color(0.55f, 0.45f, 0.34f), 0.25f);
        }

        static void BuildMachineBody(Transform root)
        {
            var prefab = Resources.Load<GameObject>(ModelPath);
            if (prefab != null)
            {
                var model = Object.Instantiate(prefab, root);
                model.name = "DrillPressModel";
                foreach (var c in model.GetComponentsInChildren<Collider>()) Object.Destroy(c);
                model.transform.localPosition = new Vector3(0f, BenchTop, 0f);
                model.transform.localRotation = Quaternion.Euler(0f, ModelYaw, 0f);
                model.transform.localScale = Vector3.one * M;
                return;
            }

            // The model did not import: a simple stand-in keeps the simulation usable.
            Debug.LogWarning("Drill press model not found at Resources/" + ModelPath + ", using simple shapes.");
            Prim(PrimitiveType.Cube, "Base", root, G(0f, 0.03f, 0.03f), new Vector3(0.34f, 0.07f, 0.45f), Steel, 0.5f, 0.6f);
            Prim(PrimitiveType.Cylinder, "Column", root, G(0f, 0.34f, -0.04f), new Vector3(0.09f, 0.34f, 0.09f), Steel, 0.7f, 0.8f);
            Prim(PrimitiveType.Cube, "Head", root, G(0f, 0.5f, -0.03f), new Vector3(0.2f, 0.25f, 0.34f), new Color(0.2f, 0.22f, 0.26f));
            Prim(PrimitiveType.Cylinder, "Chuck", root, G(0f, 0.335f, AxisZ), new Vector3(0.08f, 0.03f, 0.08f), Steel, 0.6f, 0.8f);
            Prim(PrimitiveType.Cube, "Table", root, G(0f, TableTop - 0.01f, 0.05f), new Vector3(0.4f, 0.02f, 0.45f), Steel, 0.5f, 0.5f);
        }

        // The part on the table, the vise that holds it, the drill bit and the oil nozzle.
        static void BuildWorkArea(Transform root, UiFactory ui, DrillView view, List<MachineControl> controls)
        {
            float tableY = BenchTop + TableTop * M;
            float axisZ = AxisZ * M;
            float chuckY = BenchTop + ChuckBottom * M;

            // Where the part goes, and the part itself.
            var plateSize = new Vector3(0.13f, 0.025f, 0.10f);
            var ghost = Prim(PrimitiveType.Cube, "PartGhost", root, new Vector3(0f, tableY + 0.002f, axisZ),
                new Vector3(plateSize.x, 0.004f, plateSize.z), new Color(1f, 0.71f, 0.28f), 0.1f);
            var plate = Prim(PrimitiveType.Cube, "Part", root, new Vector3(0f, tableY + plateSize.y * 0.5f, axisZ), plateSize,
                new Color(0.78f, 0.8f, 0.84f), 0.7f, 0.9f);
            plate.SetActive(false);
            var hole = Prim(PrimitiveType.Cylinder, "Hole", plate.transform, new Vector3(0f, 0.505f, 0f),
                new Vector3(0.14f, 0.003f, 0.19f), Color.black, 0f);
            hole.SetActive(false);

            var partControl = NewControl(root, ControlIds.Workpiece, "Part", ControlKind.Toggle, new[] { "removed", "placed" },
                new Vector3(0f, tableY + 0.02f, axisZ), new Vector3(0.16f, 0.06f, 0.13f));

            // Vise: a fixed block and a jaw that slides in.
            float jawY = tableY + 0.022f;
            Prim(PrimitiveType.Cube, "ViseFixed", root, new Vector3(-0.105f, jawY, axisZ), new Vector3(0.03f, 0.044f, 0.11f),
                new Color(0.22f, 0.24f, 0.28f), 0.5f, 0.6f);
            var jawRoot = NewControl(root, ControlIds.Clamp, "Clamp", ControlKind.Toggle, new[] { "released", "clamped" },
                new Vector3(0.105f, jawY, axisZ), new Vector3(0.06f, 0.07f, 0.13f));
            Prim(PrimitiveType.Cube, "Jaw", jawRoot.transform, Vector3.zero, new Vector3(0.03f, 0.044f, 0.11f), Yellow, 0.4f, 0.4f);
            AddVisual(jawRoot, VisualMode.Latch, jawRoot.transform, new Vector3(-0.02f, 0f, 0f), "clamped", null);

            // Drill bit: hangs from the chuck and grows as the drill plunges.
            var bitPivot = new GameObject("BitPivot").transform;
            bitPivot.SetParent(root, false);
            bitPivot.localPosition = new Vector3(0f, chuckY, axisZ);
            var bit = Prim(PrimitiveType.Cylinder, "Bit", bitPivot, new Vector3(0f, -0.009f, 0f), new Vector3(0.01f, 0.009f, 0.01f),
                new Color(0.82f, 0.62f, 0.2f), 0.8f, 0.9f);
            var flute = Prim(PrimitiveType.Cube, "Flute", bit.transform, new Vector3(0.5f, 0f, 0f), new Vector3(0.35f, 1f, 0.35f),
                new Color(0.3f, 0.24f, 0.1f), 0.2f);

            var nozzle = new GameObject("OilNozzle").transform;
            nozzle.SetParent(root, false);
            nozzle.localPosition = new Vector3(0.07f, chuckY + 0.02f, axisZ);
            Prim(PrimitiveType.Cube, "NozzleBody", nozzle, Vector3.zero, new Vector3(0.012f, 0.012f, 0.012f), new Color(0.2f, 0.5f, 0.9f));
            var stream = Prim(PrimitiveType.Cylinder, "OilStream", root, Vector3.zero, new Vector3(0.004f, 0.02f, 0.004f),
                new Color(0.4f, 0.8f, 1f), 0.9f);
            stream.SetActive(false);

            view.bit = bit.transform;
            view.bitFlute = flute.transform;
            view.plate = plate.transform;
            view.ghost = ghost;
            view.hole = hole.transform;
            view.nozzle = nozzle;
            view.stream = stream.transform;
            view.chuckBottomY = chuckY;
            view.plateTopY = tableY + plateSize.y;
            controls.Add(partControl);
            controls.Add(jawRoot);
            // The jaw and part colliders were created by NewControl; the part has no visual of its own.
        }

        // The feed lever on the side of the head: pulled down to drill.
        static void BuildLever(Transform root, DrillView view, List<MachineControl> controls)
        {
            float y = BenchTop + HeadMid * M;
            var pivot = NewControl(root, ControlIds.FeedLever, "Feed lever", ControlKind.Press, null,
                new Vector3(0.09f, y, AxisZ * M), new Vector3(0.3f, 0.08f, 0.08f), new Vector3(0.15f, 0f, 0f));
            Prim(PrimitiveType.Cylinder, "Arm", pivot.transform, new Vector3(0.14f, 0f, 0f), new Vector3(0.016f, 0.14f, 0.016f), Steel, 0.6f, 0.8f)
                .transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            Prim(PrimitiveType.Sphere, "Knob", pivot.transform, new Vector3(0.285f, 0f, 0f), Vector3.one * 0.05f, Yellow, 0.5f);
            view.lever = pivot.transform;
            controls.Add(pivot);
        }

        // The safety guard: a yellow frame in front of the chuck that lifts out of the way.
        static void BuildGuard(Transform root, List<MachineControl> controls)
        {
            float y = BenchTop + (ChuckBottom + 0.03f) * M;
            var guard = NewControl(root, ControlIds.Guard, "Guard", ControlKind.Toggle, new[] { "open", "closed" },
                new Vector3(0f, y, AxisZ * M + 0.085f), new Vector3(0.2f, 0.16f, 0.05f));
            var t = guard.transform;
            Prim(PrimitiveType.Cube, "L", t, new Vector3(-0.08f, 0f, 0f), new Vector3(0.008f, 0.15f, 0.008f), Yellow, 0.3f);
            Prim(PrimitiveType.Cube, "R", t, new Vector3(0.08f, 0f, 0f), new Vector3(0.008f, 0.15f, 0.008f), Yellow, 0.3f);
            for (int i = 0; i < 4; i++)
                Prim(PrimitiveType.Cube, "Bar" + i, t, new Vector3(0f, 0.075f - i * 0.05f, 0f), new Vector3(0.168f, 0.008f, 0.008f), Yellow, 0.3f);
            AddVisual(guard, VisualMode.Latch, t, new Vector3(0f, 0.2f, 0f), "open", null);
            controls.Add(guard);
        }

        // The control panel with every switch and selector, a status screen and three lamps.
        static void BuildPanel(Transform root, UiFactory ui, DrillView view, List<MachineControl> controls)
        {
            var panel = new GameObject("ControlPanel").transform;
            panel.SetParent(root, false);
            panel.localPosition = new Vector3(0f, BenchTop + 0.22f, 0.66f);
            panel.localRotation = Quaternion.Euler(-18f, 0f, 0f);
            Prim(PrimitiveType.Cube, "Body", panel, Vector3.zero, new Vector3(0.68f, 0.44f, 0.05f), PanelColor, 0.3f);

            const float z = -0.03f;   // in front of the panel face, towards the trainee
            float row1 = 0.06f, row2 = -0.07f;

            Isolator(panel, ui, view, controls, new Vector3(-0.21f, row1, z));
            Estop(panel, ui, view, controls, new Vector3(-0.07f, row1, z));
            PushButton(panel, ui, view, controls, ControlIds.Spindle, "Motor", new Vector3(0.07f, row1, z), new Color(0.15f, 0.65f, 0.3f), new Color(0.3f, 1f, 0.5f));
            PushButton(panel, ui, view, controls, ControlIds.Oil, "Cutting oil", new Vector3(0.21f, row1, z), new Color(0.15f, 0.35f, 0.65f), new Color(0.4f, 0.75f, 1f));
            Selector(panel, ui, view, controls, ControlIds.Bit, "Drill bit", new Vector3(-0.2f, row2, z), new[] { "6mm", "10mm", "13mm" });
            Selector(panel, ui, view, controls, ControlIds.Speed, "Speed", new Vector3(0f, row2, z), new[] { "LOW", "MED", "HIGH" });
            Selector(panel, ui, view, controls, ControlIds.Depth, "Depth stop", new Vector3(0.2f, row2, z), new[] { "10mm", "20mm", "30mm" });

            // Status screen and lamps along the top edge.
            var canvas = ui.WorldCanvas("_screen", panel, new Vector2(520f, 150f));
            canvas.transform.localPosition = new Vector3(0f, 0.155f, z + 0.002f);
            canvas.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            var bg = ui.Rect(canvas.transform, "Bg", new Vector2(520f, 150f), Vector2.zero);
            ui.Fill(bg, new Color(0.02f, 0.07f, 0.08f, 1f));
            var screen = ui.Text(bg, "", ui.T.caption - 4f, new Color(0.49f, 1f, 0.8f, 1f), true, TextAlignmentOptions.TopLeft,
                new Vector2(490f, 140f), Vector2.zero);
            screen.textWrappingMode = TextWrappingModes.NoWrap;
            screen.lineSpacing = -8f;
            view.screen = screen;

            view.lampGreen = Lamp(panel, new Vector3(-0.29f, 0.19f, z));
            view.lampAmber = Lamp(panel, new Vector3(-0.29f, 0.14f, z));
            view.lampRed = Lamp(panel, new Vector3(-0.29f, 0.09f, z));
        }

        static Renderer Lamp(Transform parent, Vector3 pos)
        {
            return Prim(PrimitiveType.Sphere, "Lamp", parent, pos, Vector3.one * 0.025f, Color.gray, 0.6f).GetComponent<Renderer>();
        }

        static void Isolator(Transform panel, UiFactory ui, DrillView view, List<MachineControl> controls, Vector3 pos)
        {
            var c = NewControl(panel, ControlIds.Isolator, "Main switch", ControlKind.Toggle, new[] { "off", "on" }, pos, new Vector3(0.09f, 0.09f, 0.05f));
            var knob = new GameObject("Knob").transform;
            knob.SetParent(c.transform, false);
            Prim(PrimitiveType.Cylinder, "Disc", knob, Vector3.zero, new Vector3(0.07f, 0.008f, 0.07f), new Color(0.08f, 0.08f, 0.09f), 0.5f)
                .transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            Prim(PrimitiveType.Cube, "Handle", knob, new Vector3(0f, 0.012f, -0.012f), new Vector3(0.016f, 0.07f, 0.014f), new Color(0.9f, 0.2f, 0.18f), 0.3f);
            AddVisual(c, VisualMode.Rotary, knob, Vector3.zero, null, new[] { "off", "on" }, -45f, 90f);
            Label(panel, ui, "Main switch", pos);
            controls.Add(c);
        }

        static void Estop(Transform panel, UiFactory ui, DrillView view, List<MachineControl> controls, Vector3 pos)
        {
            var c = NewControl(panel, ControlIds.Estop, "E-STOP", ControlKind.Toggle, new[] { "released", "engaged" }, pos, new Vector3(0.09f, 0.09f, 0.05f));
            Prim(PrimitiveType.Cylinder, "Ring", c.transform, new Vector3(0f, 0f, 0.004f), new Vector3(0.085f, 0.004f, 0.085f), Yellow, 0.3f)
                .transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            var button = Prim(PrimitiveType.Cylinder, "Button", c.transform, new Vector3(0f, 0f, -0.01f), new Vector3(0.065f, 0.012f, 0.065f),
                new Color(0.85f, 0.1f, 0.1f), 0.6f);
            button.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            AddVisual(c, VisualMode.Latch, button.transform, new Vector3(0f, 0f, 0.012f), "engaged", null);
            Label(panel, ui, "E-STOP", pos);
            controls.Add(c);
        }

        static void PushButton(Transform panel, UiFactory ui, DrillView view, List<MachineControl> controls, string id, string label,
            Vector3 pos, Color baseColor, Color glow)
        {
            var c = NewControl(panel, id, label, ControlKind.Toggle, new[] { "off", "on" }, pos, new Vector3(0.08f, 0.08f, 0.05f));
            var button = Prim(PrimitiveType.Cylinder, "Button", c.transform, new Vector3(0f, 0f, -0.008f), new Vector3(0.055f, 0.012f, 0.055f), baseColor, 0.6f);
            button.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            var visual = AddVisual(c, VisualMode.Latch, button.transform, new Vector3(0f, 0f, 0.008f), "on", null);
            visual.lamp = button.GetComponent<Renderer>();
            visual.lampValue = "on";
            visual.lampBase = baseColor;
            visual.lampGlow = glow;
            Label(panel, ui, label, pos);
            controls.Add(c);
        }

        static void Selector(Transform panel, UiFactory ui, DrillView view, List<MachineControl> controls, string id, string label,
            Vector3 pos, string[] values)
        {
            var c = NewControl(panel, id, label, ControlKind.Cycle, values, pos, new Vector3(0.09f, 0.09f, 0.05f));
            var knob = new GameObject("Knob").transform;
            knob.SetParent(c.transform, false);
            Prim(PrimitiveType.Cylinder, "Disc", knob, Vector3.zero, new Vector3(0.07f, 0.012f, 0.07f), new Color(0.07f, 0.07f, 0.08f), 0.5f)
                .transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            Prim(PrimitiveType.Cube, "Pointer", knob, new Vector3(0f, 0.022f, -0.009f), new Vector3(0.01f, 0.03f, 0.008f), Yellow, 0.3f);
            AddVisual(c, VisualMode.Rotary, knob, Vector3.zero, null, values, 60f, -60f);
            Label(panel, ui, label, pos);

            // The chosen value, written next to the knob so it can be read at a glance.
            var canvas = ui.WorldCanvas("_value_" + id, panel, new Vector2(160f, 44f));
            canvas.transform.localPosition = pos + new Vector3(0f, -0.088f, 0.002f);
            canvas.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            var tag = ui.Text(canvas.transform, "", ui.T.caption - 2f, ui.T.accent, true, TextAlignmentOptions.Center, new Vector2(160f, 44f), Vector2.zero);
            tag.textWrappingMode = TextWrappingModes.NoWrap;
            view.tags.Add(new KeyValuePair<string, TextMeshProUGUI>(id, tag));
            controls.Add(c);
        }

        static void Label(Transform panel, UiFactory ui, string text, Vector3 pos)
        {
            var canvas = ui.WorldCanvas("_label_" + text, panel, new Vector2(150f, 36f));
            canvas.transform.localPosition = pos + new Vector3(0f, -0.058f, 0.002f);
            canvas.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            var label = ui.Text(canvas.transform, text, ui.T.caption - 6f, ui.T.textPrimary, true, TextAlignmentOptions.Center,
                new Vector2(150f, 36f), Vector2.zero);
            label.textWrappingMode = TextWrappingModes.NoWrap;
            label.enableAutoSizing = true;
            label.fontSizeMin = 14f;
            label.fontSizeMax = ui.T.caption - 6f;
        }

        // ---- controls -----------------------------------------------------------------------------

        static MachineControl NewControl(Transform parent, string id, string label, ControlKind kind, string[] values,
            Vector3 pos, Vector3 colliderSize, Vector3? colliderCenter = null)
        {
            var go = new GameObject("ctl_" + id);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var box = go.AddComponent<BoxCollider>();
            box.size = colliderSize;
            if (colliderCenter.HasValue) box.center = colliderCenter.Value;
            var c = go.AddComponent<MachineControl>();
            c.controlId = id;
            c.label = label;
            c.kind = kind;
            c.values = values;
            return c;
        }

        static ControlVisual AddVisual(MachineControl c, VisualMode mode, Transform moving, Vector3 offset, string latchValue,
            string[] rotaryValues, float rotaryStart = -45f, float rotaryStep = 45f)
        {
            var v = c.gameObject.AddComponent<ControlVisual>();
            v.mode = mode;
            v.moving = moving;
            v.pressOffset = offset;
            v.latchValue = latchValue;
            v.rotaryValues = rotaryValues;
            v.rotaryStart = rotaryStart;
            v.rotaryStep = rotaryStep;
            c.visual = v;
            return v;
        }
    }
}
