using System.Collections;
using System.Collections.Generic;
using MrTrainer.Audio;
using MrTrainer.Core;
using MrTrainer.Machine;
using MrTrainer.Ui;
using UnityEngine;

namespace MrTrainer.Guidance
{
    public class GuideFlow : MonoBehaviour
    {
        Procedure procedure;
        MachineController machine;
        HighlightService highlight;
        StepCardPanel card;
        ModalPanel modal;
        public CertificatePanel certPanel;
        string activeCheckin;
        ToastHost toasts;
        MachinePlacer placer;
        ICheckpointService judge;
        UiFactory ui;
        Transform head;
        CoachService coach;
        CoachBanner banner;
        ApiClient api;

        readonly ActionRecorder recorder = new ActionRecorder();
        ProcedureRunner runner;
        MachineState safeMachine;
        bool hintVisible;
        bool offlineShown;

        public void Init(Procedure proc, MachineController controller, HighlightService highlighter, StepCardPanel stepCard,
            ModalPanel modalPanel, ToastHost toastHost, MachinePlacer machinePlacer, ICheckpointService service,
            UiFactory factory, Transform headTransform, CoachService coachService, CoachBanner coachBanner,
            ApiClient apiClient)
        {
            api = apiClient;
            coach = coachService;
            banner = coachBanner;
            coach.Correction += banner.Show;
            coach.AllClear += banner.Hide;
            coach.Checking += banner.SetChecking;
            coach.Offline += OnOffline;
            procedure = proc;
            machine = controller;
            highlight = highlighter;
            card = stepCard;
            modal = modalPanel;
            toasts = toastHost;
            placer = machinePlacer;
            judge = service;
            ui = factory;
            head = headTransform;

            machine.Accepted += OnAction;
            card.HintClicked += OnHint;
            card.RecenterClicked += placer.Recenter;
            card.RestartClicked += () => { if (runner != null) Begin(runner.Mode); };
            card.SwitchClicked += () =>
            {
                if (runner != null) Begin(runner.Mode == TrainingMode.Learn ? TrainingMode.Test : TrainingMode.Learn);
            };
        }

        public void ShowWelcome()
        {
            StartCoroutine(Welcome());
        }

        IEnumerator Welcome()
        {
            ApiResult<PassportResponse> passport = null;
            yield return api.Passport(Config.MachineLabel, r => passport = r);

            var spec = new ModalSpec
            {
                title = "MR Machine Trainer",
                chip = "WELCOME",
                accent = ui.T.accent,
                body = "Learn mode highlights each control and explains why. Test mode removes the hints.",
                buttons = new List<ModalButton>
                {
                    new ModalButton { label = "Learn mode", color = ui.T.accent, click = () => Begin(TrainingMode.Learn) },
                    new ModalButton { label = "Test mode", color = ui.T.warning, click = () => Begin(TrainingMode.Test) }
                }
            };
            if (passport.Ok && passport.value.registered)
            {
                var p = passport.value;
                spec.bullets.Add("Machine passport from ENS: " + p.name);
                spec.bullets.Add("Model " + p.model + ", guide v" + p.guideVersion);
                spec.bullets.Add("Procedure on 0G: " + Short(p.procedureRootHash));
            }
            else
            {
                spec.bullets.Add("ENS passport unavailable: " + (passport.Ok ? "name is not registered" : passport.error.message));
            }
            modal.Show(spec);
        }

        // Test mode needs a World-verified human who checked in on a phone first. Learn mode is open.
        void Begin(TrainingMode mode)
        {
            modal.Hide();
            if (mode == TrainingMode.Test) StartCoroutine(GateThenBegin(mode));
            else BeginCore(mode, null);
        }

        IEnumerator GateThenBegin(TrainingMode mode)
        {
            if (activeCheckin != null)
            {
                BeginCore(mode, activeCheckin);
                yield break;
            }
            modal.Show(new ModalSpec
            {
                title = "Looking for your check-in",
                chip = "WORLD",
                accent = ui.T.accent,
                body = "Checking whether a verified worker is waiting."
            });
            ApiResult<WorkerReadyResponse> ready = null;
            yield return api.WorkerReady(r => ready = r);
            modal.Hide();
            if (!ready.Ok)
            {
                ShowOffline("Could not reach the backend at " + Config.BackendUrl + ".", () => Begin(mode));
                yield break;
            }
            if (!ready.value.required)
            {
                BeginCore(mode, null);
                yield break;
            }
            if (!ready.value.ready) ShowCheckinNeeded();
            else ShowCheckinConfirm(ready.value);
        }

        void ShowCheckinNeeded()
        {
            string page = Config.BackendUrl.Replace("https://", "").Replace("http://", "") + "/checkin";
            var spec = new ModalSpec
            {
                title = "Check in first",
                chip = "WORLD",
                accent = ui.T.warning,
                body = "Test mode needs a quick human check on your phone. Take the headset off, check in, then come back."
            };
            spec.bullets.Add("Open " + page + " on your phone");
            spec.bullets.Add("Tap Verify with World and approve (about 10 seconds)");
            spec.bullets.Add("Name your licence if you like, then tap Check again here");
            spec.buttons.Add(new ModalButton { label = "Check again", color = ui.T.warning, click = () => Begin(TrainingMode.Test) });
            spec.buttons.Add(new ModalButton { label = "Learn mode", color = ui.T.accent, click = () => Begin(TrainingMode.Learn) });
            ProceduralSfx.Play(ProceduralSfx.Error, head.position);
            modal.Show(spec);
        }

        void ShowCheckinConfirm(WorkerReadyResponse worker)
        {
            string who = string.IsNullOrEmpty(worker.alias) ? "verified worker" : worker.alias;
            var spec = new ModalSpec
            {
                title = "Start as " + who + "?",
                chip = "VERIFIED",
                accent = ui.T.success,
                body = "World confirmed a real person checked in. Your Test starts now, and the result is tied to this check-in."
            };
            spec.bullets.Add("Human check: World, id " + worker.humanTag);
            spec.bullets.Add(string.IsNullOrEmpty(worker.alias)
                ? "Licence name: generated"
                : "Licence name: " + worker.alias.ToLowerInvariant() + "-cert.smartician.eth");
            spec.buttons.Add(new ModalButton { label = "Start Test", color = ui.T.success, click = () => BeginCore(TrainingMode.Test, worker.checkinId) });
            spec.buttons.Add(new ModalButton { label = "Not me", color = ui.T.border, click = () => StartCoroutine(NotMe(worker.checkinId)) });
            ProceduralSfx.Play(ProceduralSfx.Success, head.position);
            modal.Show(spec);
        }

        IEnumerator NotMe(string checkinId)
        {
            ApiResult<WorkerReadyResponse> ignored = null;
            yield return api.CancelCheckin(checkinId, r => ignored = r);
            Begin(TrainingMode.Test);
        }

        void BeginCore(TrainingMode mode, string checkinId)
        {
            modal.Hide();
            highlight.Clear();
            placer.Recenter();
            machine.ResetMachine();
            safeMachine = machine.Snapshot();
            recorder.Reset();
            hintVisible = false;
            offlineShown = false;
            runner = null;
            banner.Hide();
            StartCoroutine(Boot(mode, checkinId));
        }

        IEnumerator Boot(TrainingMode mode, string checkinId)
        {
            bool ok = false;
            yield return coach.StartSession(mode, r => ok = r);
            if (!ok)
            {
                ShowOffline("Could not reach the AI technician at " + Config.BackendUrl + ".", () => Begin(mode));
                yield break;
            }

            string verifiedName = null;
            if (checkinId != null)
            {
                ApiResult<ClaimResponse> claim = null;
                yield return api.Claim(coach.SessionId, checkinId, r => claim = r);
                if (!claim.Ok)
                {
                    activeCheckin = null;
                    coach.StopSession();
                    var spec = new ModalSpec
                    {
                        title = "Check in again",
                        chip = "WORLD",
                        accent = ui.T.warning,
                        body = "Your check-in is no longer valid, so Test mode stays locked. Check in on your phone again."
                    };
                    spec.buttons.Add(new ModalButton { label = "Check again", color = ui.T.warning, click = () => Begin(TrainingMode.Test) });
                    modal.Show(spec);
                    yield break;
                }
                activeCheckin = checkinId;
                verifiedName = string.IsNullOrEmpty(claim.value.alias) ? "verified worker" : claim.value.alias;
            }

            banner.SetChecking(false);
            runner = new ProcedureRunner(procedure);
            runner.StepChanged += OnStepChanged;
            runner.CheckpointReached += OnCheckpoint;
            runner.StageCompleted += OnStageCompleted;
            runner.Completed += OnCompleted;
            runner.Start(mode);

            toasts.Hud(verifiedName != null ? "Test mode: verified human, " + verifiedName
                    : mode == TrainingMode.Learn ? "Learn mode: follow the highlights" : "Test mode: no highlights",
                mode == TrainingMode.Learn ? ui.T.accent : ui.T.warning);
        }

        void OnOffline(string message)
        {
            if (offlineShown) return;
            offlineShown = true;
            if (runner != null) runner.Hold = true;
            ShowOffline(message, () => StartCoroutine(Reconnect()));
        }

        IEnumerator Reconnect()
        {
            bool ok = false;
            yield return coach.Reconnect(r => ok = r);
            if (ok)
            {
                offlineShown = false;
                if (runner != null) runner.Hold = false;
                toasts.Hud("AI technician back online", ui.T.success);
                yield break;
            }
            ShowOffline("Still unable to reach the AI technician.", () => StartCoroutine(Reconnect()));
        }

        void ShowOffline(string message, System.Action retry)
        {
            ProceduralSfx.Play(ProceduralSfx.Error, head.position);
            modal.Show(new ModalSpec
            {
                title = "Do not continue. Ask a supervisor.",
                chip = "SAFE STOP",
                accent = ui.T.danger,
                body = message + " Nothing unlocks while the AI technician is offline.",
                buttons = new List<ModalButton>
                {
                    new ModalButton
                    {
                        label = "Retry",
                        color = ui.T.accent,
                        click = () =>
                        {
                            modal.Hide();
                            retry();
                        }
                    }
                }
            });
        }

        void OnAction(ActionRecord r)
        {
            recorder.Add(r);
            if (runner != null) runner.OnAction(r);
        }

        void OnStepChanged()
        {
            hintVisible = false;
            card.ShowStep(runner, false);
            UpdateHighlight();
        }

        void OnHint()
        {
            if (runner == null || runner.Mode != TrainingMode.Test || runner.Locked || runner.Current == null) return;
            runner.UseHint();
            hintVisible = true;
            card.ShowStep(runner, true);
            UpdateHighlight();
        }

        void UpdateHighlight()
        {
            highlight.Clear();
            var step = runner.Current;
            if (step == null) return;
            if (runner.Mode == TrainingMode.Learn || hintVisible)
                highlight.SetTarget(step.targetControl, runner.StepNumberInStage + ". " + step.title);
        }

        void OnCheckpoint(StepDef step)
        {
            highlight.Clear();
            card.SetBusy("Checking with the AI technician...");
            StartCoroutine(RunJudge(step));
        }

        IEnumerator RunJudge(StepDef step)
        {
            yield return new WaitUntil(() => !machine.simulator.Homing && !machine.State.Running);
            yield return StartCoroutine(Judge(new CheckpointContext { step = step }));
        }

        IEnumerator Judge(CheckpointContext context)
        {
            Verdict result = null;
            yield return StartCoroutine(judge.Judge(context, v => result = v));
            ShowVerdict(result, context);
        }

        void ShowVerdict(Verdict v, CheckpointContext context)
        {
            var spec = new ModalSpec { trust = Trust(v), body = v.coachingLine };
            if (v.verdict == "safe_stop")
            {
                spec.title = "Do not continue. Ask a supervisor.";
                spec.chip = "SAFE STOP";
                spec.accent = ui.T.danger;
                spec.body = "The check could not be completed, so nothing was unlocked.";
                spec.buttons.Add(new ModalButton
                {
                    label = "Retry check",
                    color = ui.T.accent,
                    click = () =>
                    {
                        modal.Hide();
                        card.SetBusy("Checking with the AI technician...");
                        StartCoroutine(Judge(context));
                    }
                });
                ProceduralSfx.Play(ProceduralSfx.Error, head.position);
                modal.Show(spec);
                return;
            }

            bool pass = v.verdict == "pass";
            spec.title = pass ? "Checkpoint passed" : "Checkpoint failed";
            spec.chip = pass ? "PASS" : v.verdict.ToUpperInvariant();
            spec.accent = pass ? ui.T.success : ui.T.danger;
            for (int i = 0; i < Mathf.Min(2, v.mistakes.Count); i++) spec.bullets.Add(v.mistakes[i].explanation);
            spec.buttons.Add(new ModalButton
            {
                label = pass ? "Continue" : "Retry from last safe point",
                color = pass ? ui.T.success : ui.T.danger,
                click = () => Resolve(pass)
            });
            ProceduralSfx.Play(pass ? ProceduralSfx.Success : ProceduralSfx.Error, head.position);
            modal.Show(spec);
        }

        void Resolve(bool pass)
        {
            modal.Hide();
            recorder.Clear();
            if (pass)
            {
                safeMachine = machine.Snapshot();
                runner.ResolveCheckpoint(true);
                return;
            }
            runner.ResolveCheckpoint(false);
            machine.Restore(safeMachine);
            toasts.Hud("Rewound to the last safe point", ui.T.warning);
        }

        void OnStageCompleted(int stageId)
        {
            toasts.Hud("Stage " + stageId + " complete", ui.T.success);
            ProceduralSfx.Play(ProceduralSfx.Success, head.position);
        }

        void OnCompleted()
        {
            highlight.Clear();
            banner.Hide();
            StartCoroutine(Complete());
        }

        class CertState
        {
            public ApiResult<CertificateResponse> certificate;
            public ApiResult<CredentialResponse> credential;
        }

        IEnumerator Complete()
        {
            bool test = runner.Mode == TrainingMode.Test;
            string outcome = !test ? "learn_complete" : runner.TestPassed ? "test_pass" : "test_fail";
            modal.Show(new ModalSpec
            {
                title = "Saving the training record",
                chip = "0G STORAGE",
                accent = ui.T.accent,
                body = "Uploading the evidence log to 0G Storage and anchoring it on 0G Chain. This can take up to a minute."
            });
            ApiResult<FinalizeResponse> saved = null;
            yield return coach.Finalize(outcome, r => saved = r);
            coach.StopSession();

            bool passed = test && runner.TestPassed;
            var state = new CertState();
            if (passed && saved.Ok) yield return Certify(state);
            ShowResult(test, passed, saved, state);
        }

        // The licence name and the proof of human come from the worker's phone check-in, which the backend already holds.
        IEnumerator Certify(CertState state)
        {
            state.certificate = null;
            state.credential = null;
            modal.Show(new ModalSpec
            {
                title = "Issuing your ENS licence",
                chip = "ENS",
                accent = ui.T.accent,
                body = "Writing the licence to ENS on Sepolia and checking it live. This can take up to a minute."
            });
            yield return api.IssueCertificate(coach.SessionId, null, r => state.certificate = r);
            if (state.certificate.Ok)
            {
                activeCheckin = null;
                yield return api.Credential(LabelOf(state.certificate.value.name), r => state.credential = r);
            }
        }

        void ShowResult(bool test, bool passed, ApiResult<FinalizeResponse> saved, CertState state)
        {
            var spec = new ModalSpec();
            if (!test)
            {
                spec.title = "Procedure complete";
                spec.chip = "DONE";
                spec.accent = ui.T.success;
                spec.body = "You started, set up and ran the machine in the right order. Try Test mode to prove it without hints.";
                spec.buttons.Add(new ModalButton { label = "Test mode", color = ui.T.warning, click = () => Begin(TrainingMode.Test) });
                spec.buttons.Add(new ModalButton { label = "Restart", color = ui.T.accent, click = () => Begin(TrainingMode.Learn) });
            }
            else if (runner.TestPassed)
            {
                spec.title = "Test passed";
                spec.chip = "PASSED";
                spec.accent = ui.T.success;
                spec.body = "Hints used: " + runner.Hints + " of " + procedure.hintLimit + ". No checkpoint retries.";
                spec.buttons.Add(new ModalButton { label = "Restart", color = ui.T.accent, click = () => Begin(TrainingMode.Test) });
            }
            else
            {
                spec.title = "Test not passed";
                spec.chip = "TRY AGAIN";
                spec.accent = ui.T.danger;
                spec.body = "Checkpoint retries: " + runner.Retries + ". Hints used: " + runner.Hints + " of " +
                            procedure.hintLimit + ". Practice in Learn mode, then try again.";
                spec.buttons.Add(new ModalButton { label = "Learn mode", color = ui.T.accent, click = () => Begin(TrainingMode.Learn) });
                spec.buttons.Add(new ModalButton { label = "Retry test", color = ui.T.warning, click = () => Begin(TrainingMode.Test) });
            }
            AddEvidence(spec, saved);
            if (passed) AddCertificate(spec, saved.Ok, state.certificate, state.credential);
            var certificate = state.certificate;
            var credential = state.credential;
            if (passed && saved.Ok && certificate != null && certificate.Ok && certPanel != null)
                spec.buttons.Insert(0, new ModalButton
                {
                    label = "View certificate",
                    color = ui.T.success,
                    click = () => ViewCertificate(spec, saved.value, certificate.value, credential != null && credential.Ok ? credential.value : null)
                });
            else if (passed && saved.Ok && certificate != null && !certificate.Ok)
                spec.buttons.Insert(0, new ModalButton
                {
                    label = "Try licence again",
                    color = ui.T.warning,
                    click = () => StartCoroutine(RetryCertify(test, passed, saved, state))
                });
            ProceduralSfx.Play(ProceduralSfx.Success, head.position);
            modal.Show(spec);
        }

        IEnumerator RetryCertify(bool test, bool passed, ApiResult<FinalizeResponse> saved, CertState state)
        {
            modal.Hide();
            yield return Certify(state);
            ShowResult(test, passed, saved, state);
        }

        void ViewCertificate(ModalSpec back, FinalizeResponse saved, CertificateResponse cert, CredentialResponse live)
        {
            var view = new CertificateView
            {
                alias = live != null ? live.alias : null,
                name = cert.name,
                valid = live != null && live.valid,
                reason = live != null ? live.reason : "not checked",
                dates = "Issued " + (live != null && !string.IsNullOrEmpty(live.issuedAt) ? DateOnly(live.issuedAt) : "today") +
                        "   Valid until " + DateOnly(cert.expiresAt),
                verdict = live != null && !string.IsNullOrEmpty(live.verdict) ? live.verdict : "test_pass",
                className = live != null ? live.className : null,
                issuedAt = live != null ? live.issuedAt : null,
                evidence = live != null && !string.IsNullOrEmpty(live.evidence) ? live.evidence : "0g://" + saved.rootHash,
                anchorTx = saved.anchorTx,
                issueTx = cert.issueTx,
                recordsTx = cert.recordsTx
            };
            modal.Hide();
            certPanel.Show(view, callback => RecheckCertificate(cert.name, callback), () => modal.Show(back));
        }

        IEnumerator RecheckCertificate(string name, System.Action<bool, string> done)
        {
            ApiResult<CredentialResponse> result = null;
            yield return api.Credential(LabelOf(name), r => result = r);
            if (result.Ok) done(result.value.valid, result.value.reason);
            else done(false, "unreachable");
        }

        static void AddCertificate(ModalSpec spec, bool recordSaved, ApiResult<CertificateResponse> certificate,
            ApiResult<CredentialResponse> credential)
        {
            if (!recordSaved)
            {
                spec.bullets.Add("ENS certificate NOT issued: the training record was not saved first.");
                return;
            }
            if (certificate == null || !certificate.Ok)
            {
                spec.bullets.Add("ENS certificate NOT issued: " + (certificate == null ? "no response" : certificate.error.message));
                return;
            }
            var c = certificate.value;
            spec.bullets.Add("ENS certificate: " + c.name);
            spec.bullets.Add("Valid until " + DateOnly(c.expiresAt));
            if (credential != null && credential.Ok)
            {
                spec.bullets.Add("Live ENS check: " + (credential.value.valid ? "VALID" : "NOT VALID (" + credential.value.reason + ")"));
                if (!string.IsNullOrEmpty(credential.value.human))
                    spec.bullets.Add("Proof of human on the licence: " + credential.value.human);
            }
        }

        static string LabelOf(string name)
        {
            int dot = name.IndexOf('.');
            return dot > 0 ? name.Substring(0, dot) : name;
        }

        static string DateOnly(string iso)
        {
            System.DateTime parsed;
            return System.DateTime.TryParse(iso, System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal, out parsed)
                ? parsed.ToString("yyyy-MM-dd")
                : iso;
        }

        static void AddEvidence(ModalSpec spec, ApiResult<FinalizeResponse> saved)
        {
            if (!saved.Ok)
            {
                spec.bullets.Add("Training record was NOT saved to 0G: " + saved.error.message);
                return;
            }
            var f = saved.value;
            spec.bullets.Add("0G Storage root: " + Short(f.rootHash));
            spec.bullets.Add(string.IsNullOrEmpty(f.anchorTx)
                ? "0G Chain anchor failed: " + f.anchorError
                : "Anchored on 0G Chain, tx " + Short(f.anchorTx));
        }

        static string Short(string hash)
        {
            return hash.Length > 18 ? hash.Substring(0, 10) + "..." + hash.Substring(hash.Length - 6) : hash;
        }

        static TrustInfo Trust(Verdict v)
        {
            return new TrustInfo
            {
                model = v.model,
                requestId = v.requestId,
                latencyMs = v.latencyMs,
                verdict = v.verdict,
                verifiedByZeroG = !(v.model ?? "").StartsWith("local stub")
            };
        }
    }
}

