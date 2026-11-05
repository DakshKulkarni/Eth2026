using UnityEngine;

namespace MrTrainer.Machine
{
    public class CycleSimulator : MonoBehaviour
    {
        MachineState s;
        MachineController controller;
        bool homingZ;
        bool homingXY;
        float duration;

        public bool Homing { get { return homingZ || homingXY; } }

        public void Init(MachineState state, MachineController owner)
        {
            s = state;
            controller = owner;
        }

        public void StartHome(string axis)
        {
            if (axis == "z") homingZ = true; else homingXY = true;
        }

        public void Cancel()
        {
            homingZ = false;
            homingXY = false;
        }

        public void StartCycle(string kind, int feed)
        {
            s.cycle = "running";
            s.cycleKind = kind;
            s.cycleT = 0f;
            duration = (kind == "dry" ? 4f : 7f) * 100f / Mathf.Max(feed, 10);
        }

        public void StopCycle()
        {
            s.cycle = "idle";
            s.cycleKind = "";
            s.cycleT = 0f;
        }

        void Update()
        {
            if (s == null) return;
            float dt = Time.deltaTime;
            if (s.Running)
            {
                Run(dt);
                return;
            }
            if (homingZ)
            {
                s.axisZ = Mathf.MoveTowards(s.axisZ, 0f, 0.25f * dt);
                if (s.axisZ == 0f)
                {
                    homingZ = false;
                    s.homedZ = true;
                    s.Raise();
                }
            }
            if (homingXY)
            {
                s.axisX = Mathf.MoveTowards(s.axisX, 0f, 0.2f * dt);
                s.axisY = Mathf.MoveTowards(s.axisY, 0f, 0.2f * dt);
                if (s.axisX == 0f && s.axisY == 0f)
                {
                    homingXY = false;
                    s.homedX = true;
                    s.homedY = true;
                    s.Raise();
                }
            }
            if (!Homing && s.AllHomed)
            {
                s.axisX = Mathf.MoveTowards(s.axisX, 0f, 0.3f * dt);
                s.axisY = Mathf.MoveTowards(s.axisY, 0f, 0.3f * dt);
                s.axisZ = Mathf.MoveTowards(s.axisZ, 0f, 0.3f * dt);
            }
        }

        void Run(float dt)
        {
            s.cycleT += dt / duration;
            float t = Mathf.Clamp01(s.cycleT);
            float depth = s.cycleKind == "auto" ? 0.20f : 0.10f;
            float ease = Mathf.SmoothStep(0f, 1f, Mathf.Min(t / 0.15f, 1f)) *
                         (1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((t - 0.85f) / 0.15f)));
            s.axisZ = -depth * ease;
            s.axisX = 0.14f * Mathf.Sin(t * Mathf.PI * 4f) * ease;
            s.axisY = 0.09f * Mathf.Sin(t * Mathf.PI * 6f) * ease;
            if (s.cycleT < 1f) return;

            string kind = s.cycleKind;
            s.cycle = "idle";
            s.cycleKind = "";
            s.cycleT = 0f;
            s.cycleCount++;
            s.axisX = 0f;
            s.axisY = 0f;
            s.axisZ = 0f;
            controller.OnCycleFinished(kind);
        }
    }
}
