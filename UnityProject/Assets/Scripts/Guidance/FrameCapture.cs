using System;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class FrameCapture : MonoBehaviour
    {
        const int Width = 512;
        const int Height = 288;

        Transform head;
        Camera cam;
        RenderTexture target;
        Texture2D readback;

        public void Init(Transform headTransform)
        {
            head = headTransform;
            var go = new GameObject("_frameCamera");
            go.transform.SetParent(transform, false);
            cam = go.AddComponent<Camera>();
            cam.enabled = false;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.1f, 0.12f, 0.16f, 1f);
            cam.fieldOfView = 85f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 20f;
            cam.stereoTargetEye = StereoTargetEyeMask.None;
            target = new RenderTexture(Width, Height, 16);
            cam.targetTexture = target;
            readback = new Texture2D(Width, Height, TextureFormat.RGB24, false);
        }

        public string Capture()
        {
            cam.transform.SetPositionAndRotation(head.position, head.rotation);
            cam.Render();
            var previous = RenderTexture.active;
            RenderTexture.active = target;
            readback.ReadPixels(new Rect(0, 0, Width, Height), 0, 0);
            RenderTexture.active = previous;
            return "data:image/jpeg;base64," + Convert.ToBase64String(readback.EncodeToJPG(60));
        }
    }
}
