using System.Collections.Generic;
using MrTrainer.Ui;
using TMPro;
using UnityEngine;

namespace MrTrainer.Machine
{
    // Animates the drill press from its state: spinning bit, plunge, lever, part, hole, oil and the status screen.
    public class DrillView : MonoBehaviour
    {
        public DrillController drill;
        public Transform bit;
        public Transform bitFlute;
        public Transform lever;
        public Transform plate;
        public GameObject ghost;
        public Transform hole;
        public Transform stream;
        public Transform nozzle;
        public Renderer lampGreen;
        public Renderer lampAmber;
        public Renderer lampRed;
        public float chuckBottomY;
        public float plateTopY;
        public float restLength = 0.018f;

        public TextMeshProUGUI screen;
        public readonly List<KeyValuePair<string, TextMeshProUGUI>> tags = new List<KeyValuePair<string, TextMeshProUGUI>>();

        MachineState s;
        MaterialPropertyBlock block;
        Vector3 plateBase;
        float plateT;
        float spin;
        float nextText;

        void Start()
        {
            s = drill.State;
            block = new MaterialPropertyBlock();
            plateBase = plate.localScale;
        }

        void Update()
        {
            if (s == null) return;
            float dt = Time.deltaTime;

            bool placed = s.workpiece == "placed";
            plateT = Mathf.MoveTowards(plateT, placed ? 1f : 0f, dt / 0.25f);
            plate.gameObject.SetActive(plateT > 0.01f);
            plate.localScale = plateBase * Easing.OutCubic(plateT);
            ghost.SetActive(!placed);

            string holeValue = s.Get(DrillController.Hole);
            bool drilled = placed && holeValue != "none" && !string.IsNullOrEmpty(holeValue);
            hole.gameObject.SetActive(drilled);

            float diameter = BitMm() * 0.0014f;
            bool spinning = drill.SpindleOn;
            spin = Mathf.MoveTowards(spin, spinning ? 1f : 0f, dt / 0.6f);
            bit.Rotate(0f, spin * 2400f * dt, 0f, Space.Self);

            float depth = DepthMm() * 0.001f;
            float length = Mathf.Lerp(restLength, (chuckBottomY - plateTopY) + depth, drill.Plunge);
            bit.localScale = new Vector3(diameter, length * 0.5f, diameter);
            bit.localPosition = new Vector3(0f, -length * 0.5f, 0f);
            bitFlute.localScale = new Vector3(0.35f, 1f, 0.35f);

            lever.localRotation = Quaternion.Euler(0f, 0f, 14f - drill.Plunge * 48f);

            bool oilFlow = spinning && s.Get(ControlIds.Oil) == "on";
            stream.gameObject.SetActive(oilFlow);
            if (oilFlow) AimOil();

            bool alarmNow = Time.time - s.alarmTime < 1.5f;
            SetLamp(lampGreen, s.isolator == "on" && s.estop != "engaged", new Color(0.2f, 0.9f, 0.45f));
            SetLamp(lampAmber, spinning, new Color(1f, 0.7f, 0.15f));
            SetLamp(lampRed, s.estop == "engaged" || alarmNow, new Color(1f, 0.25f, 0.25f));

            if (Time.time >= nextText)
            {
                nextText = Time.time + 0.1f;
                if (screen != null) screen.text = ScreenText();
                foreach (var tag in tags) tag.Value.text = s.Get(tag.Key);
            }
        }

        float BitMm()
        {
            float mm;
            return float.TryParse(s.Get(ControlIds.Bit).Replace("mm", ""), out mm) ? mm : 6f;
        }

        float DepthMm()
        {
            float mm;
            return float.TryParse(s.Get(ControlIds.Depth).Replace("mm", ""), out mm) ? mm : 20f;
        }

        void AimOil()
        {
            Vector3 a = nozzle.position;
            Vector3 b = bit.position + Vector3.down * (bit.localScale.y * 2f);
            Vector3 d = b - a;
            float pulse = 1f + 0.2f * Mathf.Sin(Time.time * 30f);
            stream.position = (a + b) * 0.5f;
            stream.rotation = Quaternion.FromToRotation(Vector3.up, d.normalized);
            stream.localScale = new Vector3(0.004f * pulse, d.magnitude * 0.5f, 0.004f * pulse);
        }

        void SetLamp(Renderer r, bool on, Color color)
        {
            block.SetColor("_BaseColor", on ? color : color * 0.18f);
            block.SetColor("_EmissionColor", on ? color * 2f : Color.black);
            r.SetPropertyBlock(block);
        }

        string ScreenText()
        {
            string l1 = "BIT " + s.Get(ControlIds.Bit).PadRight(5) + " SPEED " + s.Get(ControlIds.Speed);
            string l2 = "DEPTH " + s.Get(ControlIds.Depth).PadRight(5) + " OIL " + s.Get(ControlIds.Oil).ToUpperInvariant();
            string l3;
            if (Time.time - s.alarmTime < 4f) l3 = "<color=#FF6B6B>" + s.alarm.ToUpperInvariant() + "</color>";
            else if (s.estop == "engaged") l3 = "E-STOP ENGAGED";
            else if (s.isolator != "on") l3 = "MAIN SWITCH OFF";
            else if (s.Running) l3 = "DRILLING...";
            else if (drill.SpindleOn) l3 = "MOTOR RUNNING";
            else if (s.Get(DrillController.Hole) != "none") l3 = "HOLE " + s.Get(DrillController.Hole).ToUpperInvariant() + " DEEP";
            else l3 = "READY";
            return l1 + "\n" + l2 + "\n" + l3;
        }
    }
}
