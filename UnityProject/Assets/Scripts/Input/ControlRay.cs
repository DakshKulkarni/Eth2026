using System.Collections;
using MrTrainer.Audio;
using UnityEngine;

namespace MrTrainer.Interaction
{
    public class ControlRay : MonoBehaviour
    {
        public OVRCameraRig rig;
        public LineRenderer line;
        public Transform cursor;
        public Material idleMaterial;
        public Material hitMaterial;
        public float maxDistance = 4f;

        Interactable hovered;
        Interactable dragging;
        Coroutine stopRoutine;

        void Update()
        {
            Transform origin = rig != null ? rig.rightControllerAnchor : null;
            if (origin == null)
            {
                line.enabled = false;
                cursor.gameObject.SetActive(false);
                return;
            }

            var ray = new Ray(origin.position, origin.forward);
            if (dragging != null)
            {
                if (OVRInput.Get(OVRInput.Button.PrimaryIndexTrigger, OVRInput.Controller.RTouch))
                {
                    dragging.DragUpdate(ray);
                    line.enabled = true;
                    line.SetPosition(0, ray.origin);
                    line.SetPosition(1, ray.origin + ray.direction * 1.2f);
                    line.sharedMaterial = hitMaterial;
                    return;
                }
                dragging.DragEnd();
                dragging = null;
            }
            Interactable hit = null;
            float distance = maxDistance;
            RaycastHit info;
            if (Physics.Raycast(ray, out info, maxDistance, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
            {
                hit = info.collider.GetComponentInParent<Interactable>();
                distance = info.distance;
            }

            if (hit != hovered)
            {
                if (hovered != null) hovered.SetHover(false);
                hovered = hit;
                if (hovered != null)
                {
                    hovered.SetHover(true);
                    Pulse(0.12f, 0.02f);
                }
            }

            Vector3 end = ray.origin + ray.direction * distance;
            line.enabled = true;
            line.SetPosition(0, ray.origin);
            line.SetPosition(1, end);
            line.sharedMaterial = hovered != null ? hitMaterial : idleMaterial;
            cursor.gameObject.SetActive(hovered != null);
            cursor.position = end;

            if (hovered != null && hovered.Draggable && OVRInput.GetDown(OVRInput.Button.PrimaryIndexTrigger, OVRInput.Controller.RTouch))
            {
                dragging = hovered;
                dragging.DragBegin(ray, distance);
                ProceduralSfx.Play(ProceduralSfx.Click, end);
                Pulse(0.3f, 0.04f);
                return;
            }
            if (hovered != null && OVRInput.GetDown(OVRInput.Button.PrimaryIndexTrigger, OVRInput.Controller.RTouch))
            {
                bool accepted = hovered.Activate();
                if (accepted)
                {
                    ProceduralSfx.Play(ProceduralSfx.Click, end);
                    Pulse(0.3f, 0.04f);
                }
                else
                {
                    ProceduralSfx.Play(ProceduralSfx.Error, end, 0.8f);
                    Pulse(0.9f, 0.12f);
                }
            }
        }

        public void Pulse(float amplitude, float seconds)
        {
            OVRInput.SetControllerVibration(1f, amplitude, OVRInput.Controller.RTouch);
            if (stopRoutine != null) StopCoroutine(stopRoutine);
            stopRoutine = StartCoroutine(StopAfter(seconds));
        }

        IEnumerator StopAfter(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            OVRInput.SetControllerVibration(0f, 0f, OVRInput.Controller.RTouch);
            stopRoutine = null;
        }
    }
}
