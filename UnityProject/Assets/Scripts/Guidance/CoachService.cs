using System;
using System.Collections;
using System.Collections.Generic;
using MrTrainer.Core;
using MrTrainer.Machine;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class CoachService : MonoBehaviour
    {
        const float Debounce = 0.05f;
        const float TickSeconds = 12f;

        public bool sendFrames = true;

        public event Action<Verdict, string> Correction;
        public event Action AllClear;
        public event Action<bool> Checking;
        public event Action<string> Offline;
        public event Action Online;

        ApiClient api;
        MachineController machine;
        FrameCapture frames;
        Transform head;

        readonly List<ActionRecord> log = new List<ActionRecord>();
        string sessionId;
        string mode = "learn";
        int seq;
        int acked;
        bool active;
        bool busy;
        bool dirty;
        bool offline;
        bool speaking;
        bool hadCorrection;
        ActionRecord lastSent;
        int lastSentSeq;
        float lastAction;
        float lastObserve;
        float sessionStart;

        public void Init(ApiClient client, MachineController controller, FrameCapture capture, Transform headTransform)
        {
            api = client;
            machine = controller;
            frames = capture;
            head = headTransform;
            machine.Accepted += OnAction;
            machine.BlockedDetail += OnBlocked;
        }

        void OnDestroy()
        {
            if (machine == null) return;
            machine.Accepted -= OnAction;
            machine.BlockedDetail -= OnBlocked;
        }

        void OnBlocked(string control, string value, string reason)
        {
            if (!active) return;
            log.Add(new ActionRecord
            {
                seq = ++seq,
                t = Mathf.Round((Time.time - sessionStart) * 10f) / 10f,
                control = control,
                action = "blocked",
                value = (string.IsNullOrEmpty(value) ? "press" : value) + " refused: " + reason
            });
            lastAction = Time.time;
            dirty = true;
        }

        public IEnumerator StartSession(TrainingMode trainingMode, Action<bool> done)
        {
            active = false;
            ApiResult<SessionStartResponse> result = null;
            yield return api.StartSession(r => result = r);
            if (!result.Ok)
            {
                done(false);
                yield break;
            }
            sessionId = result.value.sessionId;
            mode = trainingMode == TrainingMode.Test ? "test" : "learn";
            log.Clear();
            seq = 0;
            acked = 0;
            busy = false;
            dirty = false;
            offline = false;
            lastObserve = Time.time;
            sessionStart = Time.time;
            active = true;
            done(true);
        }

        public void StopSession()
        {
            active = false;
        }

        void OnAction(ActionRecord r)
        {
            log.Add(new ActionRecord
            {
                seq = ++seq,
                t = Mathf.Round((r.t - sessionStart) * 10f) / 10f,
                control = r.control,
                action = r.action,
                value = r.value
            });
            lastAction = Time.time;
            dirty = true;
        }

        void Update()
        {
            if (!active || busy || offline) return;
            if (dirty && Time.time - lastAction > Debounce)
            {
                dirty = false;
                StartCoroutine(Watch("action"));
            }
            else if (Time.time - lastObserve > TickSeconds)
            {
                StartCoroutine(Watch("tick"));
            }
        }

        IEnumerator Watch(string trigger)
        {
            busy = true;
            if (Checking != null) Checking(true);
            Verdict v = null;
            yield return Request(trigger, null, r => v = r);
            busy = false;
            if (Checking != null) Checking(false);
            lastObserve = Time.time;
            if (!active || v == null) yield break;

            if (v.verdict == "safe_stop")
            {
                offline = true;
                if (Offline != null) Offline(v.coachingLine);
                yield break;
            }
            if (v.verdict != "ok" && !string.IsNullOrEmpty(v.coachingLine))
            {
                hadCorrection = true;
                if (Correction != null) Correction(v, Describe());
                if (v.speak) StartCoroutine(Speak(v.coachingLine));
            }
            else if (v.verdict == "ok" && hadCorrection)
            {
                hadCorrection = false;
                if (AllClear != null) AllClear();
            }
        }

        string Describe()
        {
            if (lastSent == null) return "About: your last action";
            var control = machine.GetControl(lastSent.control);
            string name = control != null && !string.IsNullOrEmpty(control.label)
                ? control.label
                : lastSent.control.Replace('_', ' ');
            string text = lastSent.action == "blocked"
                ? "About: " + name + " (refused)"
                : "About: " + name + (string.IsNullOrEmpty(lastSent.value) ? "" : " " + lastSent.value);
            int since = seq - lastSentSeq;
            return since > 0 ? text + " (" + since + " action" + (since > 1 ? "s" : "") + " ago)" : text;
        }

        public IEnumerator Judge(string checkpointId, Action<Verdict> done)
        {
            yield return new WaitUntil(() => !busy);
            busy = true;
            Verdict v = null;
            yield return Request("checkpoint", checkpointId, r => v = r);
            busy = false;
            lastObserve = Time.time;
            dirty = false;
            if (v.verdict == "ok") v.verdict = "pass";
            else if (v.verdict == "correct") v.verdict = "fail";
            done(v);
        }

        public IEnumerator Finalize(string outcome, Action<ApiResult<FinalizeResponse>> done)
        {
            active = false;
            yield return new WaitUntil(() => !busy);
            busy = true;
            ApiResult<FinalizeResponse> result = null;
            yield return api.Finalize(sessionId, outcome, r => result = r);
            busy = false;
            done(result);
        }

        public IEnumerator Reconnect(Action<bool> done)
        {
            yield return new WaitUntil(() => !busy);
            busy = true;
            Verdict v = null;
            yield return Request("tick", null, r => v = r);
            busy = false;
            lastObserve = Time.time;
            bool ok = v.verdict != "safe_stop";
            if (ok)
            {
                offline = false;
                if (Online != null) Online();
            }
            done(ok);
        }

        IEnumerator Request(string trigger, string checkpointId, Action<Verdict> done)
        {
            var request = new ObserveRequest
            {
                trigger = trigger,
                checkpointId = checkpointId,
                mode = mode,
                machine = machine.State.ToDto(),
                actions = log.FindAll(a => a.seq > acked)
            };
            int sent = seq;
            if (request.actions.Count > 0)
            {
                lastSent = request.actions[request.actions.Count - 1];
                lastSentSeq = sent;
            }
            if (sendFrames && frames != null && trigger != "action") request.frame = frames.Capture();

            ApiResult<Verdict> result = null;
            yield return api.Observe(sessionId, request, r => result = r);
            if (!result.Ok)
            {
                done(new Verdict { verdict = "safe_stop", coachingLine = "AI technician unreachable. Do not continue." });
                yield break;
            }
            acked = sent;
            done(result.value);
        }

        IEnumerator Speak(string text)
        {
            if (speaking) yield break;
            speaking = true;
            ApiResult<AudioClip> result = null;
            yield return api.Tts(text, sessionId, r => result = r);
            if (result.Ok)
            {
                AudioSource.PlayClipAtPoint(result.value, head.position, 1f);
                yield return new WaitForSeconds(result.value.length);
            }
            speaking = false;
        }
    }
}
