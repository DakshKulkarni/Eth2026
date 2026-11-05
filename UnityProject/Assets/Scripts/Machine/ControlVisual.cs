using System;
using MrTrainer.Core;
using UnityEngine;

namespace MrTrainer.Machine
{
    public enum VisualMode { Momentary, Latch, Rotary }

    public class ControlVisual : MonoBehaviour
    {
        public VisualMode mode;
        public Transform moving;
        public Vector3 pressOffset = new Vector3(0f, 0f, -0.008f);
        public string latchValue;
        public string[] rotaryValues;
        public float rotaryStart = -45f;
        public float rotaryStep = 45f;
        public Renderer lamp;
        public string lampValue;
        public Color lampBase = Color.gray;
        public Color lampGlow = Color.white;

        MachineController machine;
        string id;
        Vector3 basePos;
        Quaternion baseRot;
        Vector3 baseScale;
        float press;
        float latch;
        float angle;
        bool hover;
        bool lampOn;
        MaterialPropertyBlock block;

        public void Init(MachineController owner, string controlId)
        {
            machine = owner;
            id = controlId;
            basePos = moving.localPosition;
            baseRot = moving.localRotation;
            baseScale = moving.localScale;
            block = new MaterialPropertyBlock();
            angle = RotaryTarget();
            machine.Accepted += OnAccepted;
            ApplyLamp(true);
        }

        void OnDestroy()
        {
            if (machine != null) machine.Accepted -= OnAccepted;
        }

        public void SetHover(bool on)
        {
            hover = on;
        }

        void OnAccepted(ActionRecord r)
        {
            if (mode == VisualMode.Momentary && r.control == id) press = 1f;
        }

        float RotaryTarget()
        {
            if (mode != VisualMode.Rotary) return 0f;
            int i = Array.IndexOf(rotaryValues, machine.State.Get(id));
            return rotaryStart + i * rotaryStep;
        }

        void Update()
        {
            if (machine == null) return;
            float dt = Time.deltaTime;
            moving.localScale = Vector3.Lerp(moving.localScale, baseScale * (hover ? 1.06f : 1f), 15f * dt);

            if (mode == VisualMode.Momentary)
            {
                press = Mathf.MoveTowards(press, 0f, dt / 0.12f);
                moving.localPosition = basePos + pressOffset * press;
            }
            else if (mode == VisualMode.Latch)
            {
                float target = machine.State.Get(id) == latchValue ? 1f : 0f;
                latch = Mathf.MoveTowards(latch, target, dt / 0.15f);
                moving.localPosition = basePos + pressOffset * latch;
            }
            else
            {
                angle = Mathf.MoveTowardsAngle(angle, RotaryTarget(), 420f * dt);
                moving.localRotation = baseRot * Quaternion.Euler(0f, 0f, angle);
            }
            ApplyLamp(false);
        }

        void ApplyLamp(bool force)
        {
            if (lamp == null || string.IsNullOrEmpty(lampValue)) return;
            bool on = machine.State.Get(id) == lampValue;
            if (!force && on == lampOn) return;
            lampOn = on;
            block.SetColor("_BaseColor", on ? lampGlow : lampBase);
            block.SetColor("_EmissionColor", on ? lampGlow * 1.8f : Color.black);
            lamp.SetPropertyBlock(block);
        }
    }
}
