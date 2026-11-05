using System;
using MrTrainer.Ui;
using TMPro;
using UnityEngine;

namespace MrTrainer.Machine
{
    public class MachineView : MonoBehaviour
    {
        public Transform leafLeft;
        public Transform leafRight;
        public float doorTravel = 0.56f;
        public Transform table;
        public Transform workpieceSolid;
        public GameObject workpieceGhost;
        public Transform clampJaw;
        public Transform clampLever;
        public float clampTravel = 0.02f;
        public Transform spindleHead;
        public Transform toolSpin;
        public Transform tool;
        public Transform toolTip;
        public Transform nozzleTip;
        public Transform coolantStream;
        public float[] toolLength = { 0.10f, 0.11f, 0.09f };
        public Renderer lampGreen;
        public Renderer lampYellow;
        public Renderer lampRed;
        public Transform screenAnchor;

        static readonly string[] Tools = { "T1", "T2", "T3" };

        MachineController machine;
        MachineState s;
        Vector3 leftBase, rightBase, tableBase, headBase, jawBase;
        Vector3 solidBase;
        Quaternion leverBase;
        float doorT, workT, clampT, spin;
        float nextScreen;
        TextMeshProUGUI screen;
        MaterialPropertyBlock block;

        public void Init(MachineController controller, UiFactory ui)
        {
            machine = controller;
            s = controller.State;
            block = new MaterialPropertyBlock();
            leftBase = leafLeft.localPosition;
            rightBase = leafRight.localPosition;
            tableBase = table.localPosition;
            headBase = spindleHead.localPosition;
            jawBase = clampJaw.localPosition;
            leverBase = clampLever.localRotation;
            solidBase = workpieceSolid.localScale;
            BuildLabels(ui);
            BuildScreen(ui);
        }

        void BuildLabels(UiFactory ui)
        {
            foreach (var c in machine.controls)
            {
                if (string.IsNullOrEmpty(c.label)) continue;
                var canvas = ui.WorldCanvas("_label_" + c.controlId, c.transform.parent, new Vector2(160f, 40f));
                canvas.transform.localPosition = c.transform.localPosition + new Vector3(0f, -0.058f, 0.004f);
                canvas.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
                ui.Text(canvas.transform, c.label, ui.T.caption, ui.T.textPrimary, true, TextAlignmentOptions.Center,
                    new Vector2(160f, 40f), Vector2.zero);
            }
        }

        void BuildScreen(UiFactory ui)
        {
            var canvas = ui.WorldCanvas("_screen", screenAnchor, new Vector2(480f, 150f));
            canvas.transform.localPosition = Vector3.zero;
            canvas.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            var bg = ui.Rect(canvas.transform, "Bg", new Vector2(480f, 150f), Vector2.zero);
            ui.Fill(bg, new Color(0.02f, 0.07f, 0.08f, 1f));
            screen = ui.Text(bg, "", ui.T.caption, new Color(0.49f, 1f, 0.8f, 1f), true, TextAlignmentOptions.TopLeft,
                new Vector2(456f, 140f), Vector2.zero);
            screen.textWrappingMode = TextWrappingModes.NoWrap;
            screen.lineSpacing = -12f;
        }

        void Update()
        {
            if (s == null) return;
            float dt = Time.deltaTime;

            doorT = Mathf.MoveTowards(doorT, s.door == "open" ? 1f : 0f, dt / 0.9f);
            float de = Easing.InOutCubic(doorT);
            leafLeft.localPosition = leftBase + Vector3.left * (doorTravel * de);
            leafRight.localPosition = rightBase + Vector3.right * (doorTravel * de);

            table.localPosition = tableBase + new Vector3(s.axisX, 0f, s.axisY);

            bool placed = s.workpiece == "placed";
            workT = Mathf.MoveTowards(workT, placed ? 1f : 0f, dt / 0.25f);
            workpieceSolid.gameObject.SetActive(workT > 0.01f);
            workpieceSolid.localScale = solidBase * Easing.OutCubic(workT);
            workpieceGhost.SetActive(!placed);

            clampT = Mathf.MoveTowards(clampT, s.clamped ? 1f : 0f, dt / 0.3f);
            clampJaw.localPosition = jawBase + Vector3.left * (clampTravel * clampT);
            clampLever.localRotation = leverBase * Quaternion.Euler(0f, 0f, 90f * clampT);

            spindleHead.localPosition = headBase + Vector3.up * s.axisZ;
            bool spinning = s.power == "on" && s.Running && s.cycleKind == "auto";
            spin = Mathf.MoveTowards(spin, spinning ? 1f : 0f, dt / 0.5f);
            toolSpin.Rotate(0f, spin * 1500f * dt, 0f, Space.Self);
            ApplyTool();

            bool flow = s.power == "on" && s.coolant && s.Running;
            coolantStream.gameObject.SetActive(flow);
            if (flow) AimCoolant();

            bool alarmNow = Time.time - s.alarmTime < 1.5f;
            SetLamp(lampGreen, s.power == "on", new Color(0.1f, 0.85f, 0.4f));
            SetLamp(lampYellow, s.Running, new Color(1f, 0.7f, 0.1f));
            SetLamp(lampRed, s.estop == "engaged" || alarmNow, new Color(1f, 0.2f, 0.2f));

            if (Time.time >= nextScreen)
            {
                nextScreen = Time.time + 0.1f;
                screen.text = ScreenText();
            }
        }

        void ApplyTool()
        {
            int i = Mathf.Max(0, Array.IndexOf(Tools, s.tool));
            float len = toolLength[i];
            tool.localPosition = new Vector3(0f, -0.08f - len * 0.5f, 0f);
            tool.localScale = new Vector3(0.024f, len * 0.5f, 0.024f);
        }

        void AimCoolant()
        {
            Vector3 a = nozzleTip.position;
            Vector3 b = toolTip.position;
            Vector3 d = b - a;
            float pulse = 1f + 0.2f * Mathf.Sin(Time.time * 30f);
            coolantStream.position = (a + b) * 0.5f;
            coolantStream.rotation = Quaternion.FromToRotation(Vector3.up, d.normalized);
            coolantStream.localScale = new Vector3(0.012f * pulse, d.magnitude * 0.5f, 0.012f * pulse);
        }

        void SetLamp(Renderer r, bool on, Color color)
        {
            block.SetColor("_BaseColor", on ? color : color * 0.18f);
            block.SetColor("_EmissionColor", on ? color * 2f : Color.black);
            r.SetPropertyBlock(block);
        }

        string ScreenText()
        {
            string prog = string.IsNullOrEmpty(s.program) ? "----" : s.program;
            string cyc = s.Running ? s.cycleKind.ToUpperInvariant() + " RUN" : "IDLE";
            string l1 = s.mode.PadRight(5) + s.tool + "  " + prog;
            string l2 = "FEED " + s.feed + "%  COOL " + (s.coolant ? "ON" : "OFF") + "  " + cyc;
            string l3 = string.Format("X{0:+000;-000;+000} Y{1:+000;-000;+000} Z{2:+000;-000;+000}",
                s.axisX * 1000f, s.axisY * 1000f, s.axisZ * 1000f);
            string l4;
            if (Time.time - s.alarmTime < 4f) l4 = "<color=#FF4D4F>" + s.alarm.ToUpperInvariant() + "</color>";
            else if (s.estop == "engaged") l4 = "E-STOP ENGAGED";
            else if (s.power != "on") l4 = "POWER OFF";
            else l4 = s.AllHomed ? "AXES HOMED" : "HOME REQUIRED";
            return l1 + "\n" + l2 + "\n" + l3 + "\n" + l4;
        }
    }
}
