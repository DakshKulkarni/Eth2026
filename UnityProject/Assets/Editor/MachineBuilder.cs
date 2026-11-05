using MrTrainer.Machine;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace MrTrainer.Editor
{
    public class BuiltMachine
    {
        public GameObject root;
        public MachineController controller;
        public MachineView view;
        public MachinePlacer placer;
    }

    public class MachineMaterials
    {
        public Material steel = MaterialLibrary.Lit("Steel", new Color(0.55f, 0.57f, 0.6f), 0.8f, 0.55f);
        public Material dark = MaterialLibrary.Lit("DarkSteel", new Color(0.13f, 0.14f, 0.16f), 0.6f, 0.45f);
        public Material plate = MaterialLibrary.Lit("TablePlate", new Color(0.2f, 0.25f, 0.32f), 0.7f, 0.5f);
        public Material panel = MaterialLibrary.Lit("PanelDark", new Color(0.07f, 0.08f, 0.1f), 0.2f, 0.35f);
        public Material alu = MaterialLibrary.Lit("Aluminium", new Color(0.8f, 0.82f, 0.85f), 0.9f, 0.6f);
        public Material tool = MaterialLibrary.Lit("ToolCarbide", new Color(0.95f, 0.55f, 0.1f), 0.8f, 0.6f);
        public Material white = MaterialLibrary.Lit("White", Color.white, 0f, 0.3f);
        public Material knob = MaterialLibrary.Lit("Knob", new Color(0.22f, 0.24f, 0.28f), 0.3f, 0.4f);
        public Material lamp = MaterialLibrary.Lit("Lamp", Color.white, 0f, 0.5f, true);
        public Material red = MaterialLibrary.Lit("BtnRed", new Color(0.85f, 0.1f, 0.1f), 0f, 0.5f, true);
        public Material green = MaterialLibrary.Lit("BtnGreen", new Color(0.1f, 0.75f, 0.35f), 0f, 0.5f, true);
        public Material blue = MaterialLibrary.Lit("BtnBlue", new Color(0.2f, 0.45f, 1f), 0f, 0.5f, true);
        public Material yellow = MaterialLibrary.Lit("BtnYellow", new Color(1f, 0.8f, 0.1f), 0f, 0.5f, true);
        public Material cyan = MaterialLibrary.Lit("BtnCyan", new Color(0.2f, 0.85f, 1f), 0f, 0.5f, true);
        public Material glass = MaterialLibrary.Transparent("Glass", new Color(0.45f, 0.7f, 0.85f, 0.22f));
        public Material ghost = MaterialLibrary.Transparent("Ghost", new Color(1f, 1f, 1f, 0.18f));
        public Material coolant = MaterialLibrary.Transparent("Coolant", new Color(0.2f, 0.85f, 1f, 0.5f));
        public Material blob = MaterialLibrary.Transparent("Blob", new Color(0f, 0f, 0f, 0.3f));
        public Material ring = MaterialLibrary.Unlit("FloorRing", new Color(0.3f, 0.55f, 1f));
    }

    public static class MachineBuilder
    {
        static readonly string[] OnOff = { "off", "on" };

        public static BuiltMachine Build(Transform parent, GameObject shell, MachineMaterials m)
        {
            var root = new GameObject("Machine");
            root.transform.SetParent(parent, false);
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(shell, root.transform);
            instance.name = "Shell";

            var built = new BuiltMachine { root = root };
            built.controller = root.AddComponent<MachineController>();
            built.controller.simulator = root.AddComponent<CycleSimulator>();
            built.view = root.AddComponent<MachineView>();
            built.placer = root.AddComponent<MachinePlacer>();
            built.placer.machineRoot = root.transform;

            BuildDoor(Anchor(root.transform, "Anchor_Door", new Vector3(-0.047f, 1.12f, 0.60f), Quaternion.identity), m, built.view);
            BuildPanel(Anchor(root.transform, "Anchor_Panel", new Vector3(-1.015f, 1.146f, 0.765f), Quaternion.Euler(-28f, 0f, 0f)), m, built.view);
            BuildTable(Anchor(root.transform, "Anchor_Table", new Vector3(0.05f, 0.66f, 0.04f), Quaternion.identity), m, built.view);
            BuildSpindle(Anchor(root.transform, "Anchor_Spindle", new Vector3(0.056f, 1.22f, 0f), Quaternion.identity), root.transform, m, built.view);
            BuildStackLight(Anchor(root.transform, "StackLight", new Vector3(0.92f, 1.83f, 0.25f), Quaternion.identity), m, built.view);
            BuildFootprint(root.transform, m);

            built.controller.controls = root.GetComponentsInChildren<MachineControl>();
            return built;
        }

        static Transform Anchor(Transform parent, string name, Vector3 pos, Quaternion rot)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = rot;
            return go.transform;
        }

        static GameObject Prim(PrimitiveType type, string name, Transform parent, Vector3 pos, Vector3 scale, Material mat, bool collider = false)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (!collider) Object.DestroyImmediate(go.GetComponent<Collider>());
            return go;
        }

        static Renderer Cyl(Transform parent, string name, float diameter, float height, Material mat)
        {
            var go = Prim(PrimitiveType.Cylinder, name, parent, new Vector3(0f, 0f, height * 0.5f),
                new Vector3(diameter, height * 0.5f, diameter), mat);
            go.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            return go.GetComponent<Renderer>();
        }

        static MachineControl MakeControl(Transform parent, string id, string label, ControlKind kind, string[] values,
            Vector3 pos, Vector3 hitSize, bool withVisual)
        {
            var root = new GameObject("Control_" + id);
            root.transform.SetParent(parent, false);
            root.transform.localPosition = pos;
            var hit = root.AddComponent<BoxCollider>();
            hit.size = hitSize;
            hit.center = new Vector3(0f, 0f, hitSize.z * 0.35f);
            var mc = root.AddComponent<MachineControl>();
            mc.controlId = id;
            mc.label = label;
            mc.kind = kind;
            mc.values = values;
            if (withVisual)
            {
                var moving = new GameObject("Moving").transform;
                moving.SetParent(root.transform, false);
                var visual = root.AddComponent<ControlVisual>();
                visual.moving = moving;
                mc.visual = visual;
            }
            return mc;
        }

        static void Pointer(Transform moving, float diameter, float height, Material mat)
        {
            Prim(PrimitiveType.Cube, "Pointer", moving, new Vector3(0f, diameter * 0.32f, height + 0.002f),
                new Vector3(0.006f, diameter * 0.3f, 0.004f), mat);
        }

        static MachineControl Rotary(Transform panel, string id, string label, string[] values, Vector3 pos,
            float start, float step, Material knob, MachineMaterials m, ControlKind kind = ControlKind.Cycle)
        {
            var mc = MakeControl(panel, id, label, kind, values, pos, new Vector3(0.1f, 0.1f, 0.06f), true);
            Cyl(mc.visual.moving, "Knob", 0.06f, 0.025f, knob);
            Pointer(mc.visual.moving, 0.06f, 0.025f, m.white);
            mc.visual.mode = VisualMode.Rotary;
            mc.visual.rotaryValues = values;
            mc.visual.rotaryStart = start;
            mc.visual.rotaryStep = step;
            return mc;
        }

        static MachineControl Button(Transform panel, string id, string label, ControlKind kind, string[] values,
            Vector3 pos, Material mat, Color color, string lampValue, float diameter = 0.055f)
        {
            var mc = MakeControl(panel, id, label, kind, values, pos, new Vector3(0.1f, 0.1f, 0.06f), true);
            var face = Cyl(mc.visual.moving, "Face", diameter, 0.02f, mat);
            mc.visual.mode = VisualMode.Momentary;
            if (!string.IsNullOrEmpty(lampValue))
            {
                mc.visual.lamp = face;
                mc.visual.lampValue = lampValue;
                mc.visual.lampBase = color * 0.35f;
                mc.visual.lampGlow = color;
            }
            return mc;
        }

        static void BuildPanel(Transform panel, MachineMaterials m, MachineView view)
        {
            Prim(PrimitiveType.Cube, "Bezel", panel, new Vector3(0f, 0f, -0.012f), new Vector3(0.59f, 0.81f, 0.02f), m.dark);
            Prim(PrimitiveType.Cube, "Plate", panel, new Vector3(0f, 0f, -0.0105f), new Vector3(0.56f, 0.78f, 0.02f), m.panel);
            view.screenAnchor = Anchor(panel, "Screen", new Vector3(0f, 0.30f, 0.001f), Quaternion.identity);

            float c0 = 0.17f, c1 = 0f, c2 = -0.17f;
            float r1 = 0.10f, r2 = -0.02f, r3 = -0.14f, r4 = -0.26f;

            var estop = MakeControl(panel, ControlIds.Estop, "E-STOP", ControlKind.Toggle, new[] { "engaged", "released" },
                new Vector3(c0, r1, 0f), new Vector3(0.1f, 0.1f, 0.06f), true);
            Cyl(estop.transform, "Collar", 0.09f, 0.012f, m.yellow);
            estop.visual.moving.localPosition = new Vector3(0f, 0f, 0.012f);
            Cyl(estop.visual.moving, "Cap", 0.07f, 0.03f, m.red);
            estop.visual.mode = VisualMode.Latch;
            estop.visual.latchValue = "engaged";
            estop.visual.pressOffset = new Vector3(0f, 0f, -0.014f);

            Rotary(panel, ControlIds.Isolator, "ISOLATOR", OnOff, new Vector3(c1, r1, 0f), 0f, 90f, m.yellow, m, ControlKind.Toggle);
            Button(panel, ControlIds.Power, "POWER", ControlKind.Toggle, OnOff, new Vector3(c2, r1, 0f), m.green,
                new Color(0.1f, 0.75f, 0.35f), "on");

            Rotary(panel, ControlIds.Mode, "MODE", new[] { "JOG", "HOME", "DRY", "AUTO" }, new Vector3(c0, r2, 0f), -75f, 50f, m.knob, m);
            Rotary(panel, ControlIds.Tool, "TOOL", new[] { "T1", "T2", "T3" }, new Vector3(c1, r2, 0f), -50f, 50f, m.knob, m);
            Rotary(panel, ControlIds.Program, "PROGRAM", new[] { "O1001", "O1002", "O1003" }, new Vector3(c2, r2, 0f), -50f, 50f, m.knob, m);

            Button(panel, ControlIds.HomeZ, "HOME Z", ControlKind.Press, null, new Vector3(c0, r3, 0f), m.blue,
                new Color(0.2f, 0.45f, 1f), "homed");
            Button(panel, ControlIds.HomeXY, "HOME XY", ControlKind.Press, null, new Vector3(c1, r3, 0f), m.blue,
                new Color(0.2f, 0.45f, 1f), "homed");
            Rotary(panel, ControlIds.Feed, "FEED", new[] { "100", "50" }, new Vector3(c2, r3, 0f), 40f, -80f, m.knob, m, ControlKind.Toggle);

            Button(panel, ControlIds.Coolant, "COOLANT", ControlKind.Toggle, OnOff, new Vector3(c0, r4, 0f), m.cyan,
                new Color(0.2f, 0.85f, 1f), "on");
            Button(panel, ControlIds.CycleStop, "STOP", ControlKind.Press, null, new Vector3(c1, r4, 0f), m.red,
                new Color(0.85f, 0.1f, 0.1f), null);
            Button(panel, ControlIds.CycleStart, "START", ControlKind.Press, null, new Vector3(c2, r4, 0f), m.green,
                new Color(0.1f, 0.75f, 0.35f), "running");
        }

        static void BuildDoor(Transform anchor, MachineMaterials m, MachineView view)
        {
            Prim(PrimitiveType.Cube, "RailTop", anchor, new Vector3(0f, 0.57f, 0.005f), new Vector3(1.14f, 0.04f, 0.05f), m.dark);
            Prim(PrimitiveType.Cube, "RailBottom", anchor, new Vector3(0f, -0.57f, 0.005f), new Vector3(1.14f, 0.04f, 0.05f), m.dark);

            var door = MakeControl(anchor, ControlIds.Door, "", ControlKind.Toggle, new[] { "closed", "open" },
                Vector3.zero, new Vector3(0.1f, 0.1f, 0.1f), false);
            Object.DestroyImmediate(door.GetComponent<BoxCollider>());
            view.leafLeft = Leaf(door.transform, "LeafLeft", -0.27f, 0.22f, m);
            view.leafRight = Leaf(door.transform, "LeafRight", 0.27f, -0.22f, m);
        }

        static Transform Leaf(Transform parent, string name, float x, float handleX, MachineMaterials m)
        {
            var leaf = new GameObject(name);
            leaf.transform.SetParent(parent, false);
            leaf.transform.localPosition = new Vector3(x, 0f, 0f);
            Prim(PrimitiveType.Cube, "Glass", leaf.transform, Vector3.zero, new Vector3(0.55f, 1.10f, 0.03f), m.glass, true);
            Prim(PrimitiveType.Cylinder, "Handle", leaf.transform, new Vector3(handleX, 0f, 0.03f), new Vector3(0.02f, 0.18f, 0.02f), m.dark);
            return leaf.transform;
        }

        static void BuildTable(Transform anchor, MachineMaterials m, MachineView view)
        {
            var plate = new GameObject("Plate").transform;
            plate.SetParent(anchor, false);
            view.table = plate;
            Prim(PrimitiveType.Cube, "Top", plate, new Vector3(0f, 0.02f, 0f), new Vector3(0.80f, 0.04f, 0.50f), m.plate);
            for (int i = -2; i <= 2; i++)
                Prim(PrimitiveType.Cube, "Slot" + i, plate, new Vector3(0f, 0.0415f, i * 0.09f), new Vector3(0.80f, 0.002f, 0.02f), m.dark);
            Prim(PrimitiveType.Cube, "ViseBase", plate, new Vector3(0f, 0.055f, 0f), new Vector3(0.40f, 0.03f, 0.22f), m.steel);
            Prim(PrimitiveType.Cube, "FixedJaw", plate, new Vector3(-0.13f, 0.115f, 0f), new Vector3(0.04f, 0.09f, 0.20f), m.steel);

            var jaw = new GameObject("Jaw").transform;
            jaw.SetParent(plate, false);
            jaw.localPosition = new Vector3(0.13f, 0.115f, 0f);
            Prim(PrimitiveType.Cube, "JawBody", jaw, Vector3.zero, new Vector3(0.04f, 0.09f, 0.20f), m.steel);
            view.clampJaw = jaw;

            var clamp = MakeControl(jaw, ControlIds.Clamp, "", ControlKind.Toggle, new[] { "released", "clamped" },
                new Vector3(0.05f, 0f, 0f), new Vector3(0.14f, 0.12f, 0.12f), false);
            var pivot = new GameObject("LeverPivot").transform;
            pivot.SetParent(clamp.transform, false);
            view.clampLever = pivot;
            var lever = Prim(PrimitiveType.Cylinder, "Lever", pivot, new Vector3(0.06f, 0f, 0f), new Vector3(0.018f, 0.06f, 0.018f), m.dark);
            lever.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            Prim(PrimitiveType.Sphere, "Knob", pivot, new Vector3(0.12f, 0f, 0f), Vector3.one * 0.04f, m.red);

            var work = MakeControl(plate, ControlIds.Workpiece, "", ControlKind.Toggle, new[] { "removed", "placed" },
                new Vector3(0f, 0.13f, 0f), new Vector3(0.18f, 0.14f, 0.16f), false);
            work.GetComponent<BoxCollider>().center = Vector3.zero;
            var size = new Vector3(0.16f, 0.12f, 0.14f);
            view.workpieceSolid = Prim(PrimitiveType.Cube, "Solid", work.transform, Vector3.zero, size, m.alu).transform;
            view.workpieceGhost = Prim(PrimitiveType.Cube, "Ghost", work.transform, Vector3.zero, size, m.ghost);
        }

        static void BuildSpindle(Transform anchor, Transform root, MachineMaterials m, MachineView view)
        {
            var head = new GameObject("Head").transform;
            head.SetParent(anchor, false);
            view.spindleHead = head;
            Prim(PrimitiveType.Cylinder, "Holder", head, new Vector3(0f, -0.04f, 0f), new Vector3(0.07f, 0.04f, 0.07f), m.steel);

            var spin = new GameObject("ToolSpin").transform;
            spin.SetParent(head, false);
            view.toolSpin = spin;
            var tool = Prim(PrimitiveType.Cylinder, "Tool", spin, new Vector3(0f, -0.13f, 0f), new Vector3(0.024f, 0.05f, 0.024f), m.tool).transform;
            view.tool = tool;
            var tip = new GameObject("Tip").transform;
            tip.SetParent(tool, false);
            tip.localPosition = new Vector3(0f, -1f, 0f);
            view.toolTip = tip;
            Prim(PrimitiveType.Cube, "Flute", spin, new Vector3(0.013f, -0.12f, 0f), new Vector3(0.004f, 0.05f, 0.004f), m.white);

            Prim(PrimitiveType.Cylinder, "Nozzle", head, new Vector3(0.07f, -0.03f, 0f), new Vector3(0.012f, 0.04f, 0.012f), m.dark);
            view.nozzleTip = Anchor(head, "NozzleTip", new Vector3(0.07f, -0.07f, 0f), Quaternion.identity);

            var stream = Prim(PrimitiveType.Cylinder, "CoolantStream", root, Vector3.zero, new Vector3(0.012f, 0.1f, 0.012f), m.coolant);
            stream.SetActive(false);
            view.coolantStream = stream.transform;
        }

        static void BuildStackLight(Transform tower, MachineMaterials m, MachineView view)
        {
            Prim(PrimitiveType.Cylinder, "Base", tower, new Vector3(0f, 0.02f, 0f), new Vector3(0.05f, 0.02f, 0.05f), m.dark);
            view.lampGreen = Lamp(tower, 0.07f, m);
            view.lampYellow = Lamp(tower, 0.125f, m);
            view.lampRed = Lamp(tower, 0.18f, m);
        }

        static Renderer Lamp(Transform tower, float y, MachineMaterials m)
        {
            return Prim(PrimitiveType.Cylinder, "Lamp", tower, new Vector3(0f, y, 0f), new Vector3(0.06f, 0.025f, 0.06f), m.lamp)
                .GetComponent<Renderer>();
        }

        static void BuildFootprint(Transform root, MachineMaterials m)
        {
            Prim(PrimitiveType.Cylinder, "BlobShadow", root, new Vector3(0f, 0.002f, 0f), new Vector3(2.9f, 0.001f, 2.1f), m.blob);
            var ring = new GameObject("FloorRing");
            ring.transform.SetParent(root, false);
            var line = ring.AddComponent<LineRenderer>();
            line.useWorldSpace = false;
            line.loop = true;
            line.positionCount = 4;
            line.widthMultiplier = 0.02f;
            line.SetPositions(new[]
            {
                new Vector3(-1.35f, 0.005f, -1.0f), new Vector3(1.35f, 0.005f, -1.0f),
                new Vector3(1.35f, 0.005f, 1.0f), new Vector3(-1.35f, 0.005f, 1.0f)
            });
            line.sharedMaterial = m.ring;
            line.shadowCastingMode = ShadowCastingMode.Off;
        }
    }
}
