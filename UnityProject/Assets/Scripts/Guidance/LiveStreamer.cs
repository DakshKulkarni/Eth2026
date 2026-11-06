using System.Collections;
using MrTrainer.Core;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering;

namespace MrTrainer.Guidance
{
    // Streams what the worker sees to the backend as live video (motion JPEG, about 15 frames a second),
    // so the dashboard can show the session while the app is demonstrated.
    // The picture is read back from the GPU without stalling, so the headset keeps its frame rate.
    public class LiveStreamer : MonoBehaviour
    {
        const int Width = 640;
        const int Height = 360;
        const int Quality = 50;
        const int MaxInFlight = 3;
        const float FailureBackoff = 2f;

        ApiClient api;
        FrameCapture frames;
        bool reading;
        int inFlight;
        int sequence;
        float next;

        public void Init(ApiClient client, FrameCapture capture)
        {
            api = client;
            frames = capture;
            next = Time.unscaledTime + 2f;
        }

        void Update()
        {
            if (!Config.LiveEnabled || api == null || frames == null) return;
            if (reading || inFlight >= MaxInFlight || Time.unscaledTime < next) return;
            next = Time.unscaledTime + Config.LiveInterval;
            Capture();
        }

        void Capture()
        {
            var texture = frames.RenderLive(Width, Height);
            if (texture == null) return;
            int mine = ++sequence;

            if (!SystemInfo.supportsAsyncGPUReadback)
            {
                byte[] direct = frames.CaptureJpeg(Width, Height, Quality);
                if (direct != null) StartCoroutine(Send(direct, mine));
                return;
            }

            reading = true;
            AsyncGPUReadback.Request(texture, 0, texture.graphicsFormat, request =>
            {
                reading = false;
                if (request.hasError) return;
                var encoded = ImageConversion.EncodeNativeArrayToJPG(request.GetData<byte>(), texture.graphicsFormat,
                    (uint)texture.width, (uint)texture.height, 0, Quality);
                byte[] jpeg = encoded.ToArray();
                encoded.Dispose();
                StartCoroutine(Send(jpeg, mine));
            });
        }

        IEnumerator Send(byte[] jpeg, int number)
        {
            inFlight++;
            bool ok = false;
            yield return api.LiveFrame(jpeg, number, r => ok = r);
            inFlight--;
            if (!ok) next = Time.unscaledTime + FailureBackoff;
        }
    }
}
