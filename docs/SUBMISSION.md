# ETHGlobal Mumbai submission kit

Draft text for every written field, written from what is actually built and verified. Anything in **[square brackets]** is something only you can fill in. I could not open the submission form (it is behind ETHGlobal's email login), so field names and limits below come from the public event rules and prize pages, not from the form itself. Check each field's limit when you paste.

## 0. Rules that matter (from the event page and prize pages)

- **Deadline:** Saturday 7 November 2026, 09:00 IST. Late submissions are not accepted.
- **Partner prizes:** pick up to 3 on the last step. You are entering **0G** (Physical AI: Agents with a Body), **ENS** (Best Use of ENSv2) and **World** (World ID Agent Pass). Partners judge only from what you write and link, so the text below matters.
- **Demo video:** must be **2 to 4 minutes** or the upload is rejected, at least **720p**, no sped-up footage, no music-with-text instead of talking, not recorded on a phone, no AI voiceover. **0G wants it under 3 minutes**, so aim for **2:00 to 2:59**.
- **Repository:** public GitHub repo with a **README and setup instructions** (0G requires this). Regular commits. You have 32 commits starting 5 Nov 22:11, which fits the "from scratch" rule.
- **AI tools:** you must say where and how AI was used, including which files or assets. See section 6. If you used a spec-driven workflow, ETHGlobal says to include the spec and planning files in the repo.
- **Judging categories:** Technicality, Originality, Practicality, Usability, and WOW factor.

## 1. Project name and short description

**Project name:** Smartician

**Short description** (the sample showcase page limits this line to 60–100 characters; yours is 86):

> A Quest 3 trainer where a 0G AI examiner judges operators and the licence lives on ENS

Alternatives (88 and 87 characters):
- Mixed-reality CNC trainer: a 0G AI examiner passes workers, their licence is an ENS name
- An AI examiner on 0G passes CNC operators; the licence is an ENS name anyone can verify

## 2. Description

AI is starting to decide who is allowed to run dangerous machines. Today the training record lives in the training company's own database, so after an accident nobody outside can tell whether the record, or the AI's decision, was real.

Smartician is a mixed-reality trainer for a CNC vertical machining centre on the Meta Quest 3. The worker stands in front of a virtual machine with real interlocks and works through a 22-step start-up, set-up and run procedure. An AI technician running on 0G watches every action and the machine's state, corrects mistakes by voice within about three seconds, and must pass the worker at four safety checkpoints. In Test mode there are no hints.

Every session becomes a hash-chained episode log stored on 0G Storage, with a 0G request id for each AI decision, and its root hash is anchored on 0G Chain. A worker who passes receives a licence: an expiring, revocable ENS subname of smartician.eth (ENSv2 on Sepolia) whose key-value records point back to that evidence. Before Test mode unlocks, the worker checks in on their phone with World, so a real person took the test, not a stand-in.

Anyone can verify a licence without asking us. Our public verify page, or ENS and 0G directly, check the licence, the anchor and the stored session live. The same root hash appears in 0G Storage, in the 0G Chain anchor and in the ENS record `mrt.evidence`, and the same human id appears in the evidence and on the licence.

**Why web3 (what breaks without each piece)**
- **0G:** the training company could quietly change the AI's verdict or rewrite the session log after an accident. With the decisions stored on 0G Storage and anchored on 0G Chain, insurers and investigators can check them.
- **ENS:** the licence would be stuck in one company's database. With ENS, a new employer reads it directly, and a revocation is public.
- **World:** someone could sit the test for another person. A World check ties each attempt to one real person.

**What is real today:** the full loop runs on a Quest 3 and a hosted backend. A verified example: session `d1-cert` has 30 chained records and 26 AI verdicts by `qwen3.8-flash` on 0G, judged in a median of about 2.7 seconds, with 0 safe-stops in 32 consecutive calls on the hosted server.

**Honest limits:** the chains are testnets (0G Galileo, Ethereum Sepolia). World runs in its sandbox with test identities, so this is not production-grade verification. The machine is a simulation, so a licence here is evidence from a simulated assessment, not a regulatory certification. "One human, one licence" is recorded on the licence but not enforced.

## 3. How it's made

**Headset app.** Unity 6 with the Meta XR SDK (OpenXR) on Quest 3, with passthrough and controllers. The CNC model is imported as glTF. The machine has real interlocks that run locally (for example, a door that is open blocks cycle start), so motion stays on the device and 0G makes the decisions at key moments. The UI is built from world-space panels.

**Backend.** Node and TypeScript on Fastify, validated with zod, hosted on Railway. The headset sends each new action and the machine state to the backend. The backend asks a 0G model to judge, validates the answer against a strict schema, and returns a verdict. If 0G cannot be reached, the headset shows a red "Do not continue" panel and nothing unlocks. There is no fallback that fakes a decision.

**0G.** The judge is `qwen3.8-flash` on the 0G Router, with camera frames sent as base64 images at checkpoints. Corrections are spoken with 0G text to speech (`minimax-speech-02-turbo`). Each session is uploaded as a hash-chained bundle to 0G Storage with the 0G SDK, and its root is anchored by a small Solidity contract, `SessionRegistry`, on 0G Galileo. The backend can download a stored bundle by root hash and re-verify the chain, which is how the replay player works.

**ENS (ENSv2, Sepolia).** We deployed our own UserRegistry through the VerifiableFactory and linked it under `smartician.eth`. A custom Solidity `CertificateRegistrar` lets only the issuer wallet issue licences (up to 365 days) and revoke them. The resolver uses Enhanced Access Control so the issuer can write only specific text keys: `mrt.evidence`, `mrt.verdict`, `mrt.issuedAt`, `alias`, `description`, `class` and `mrt.human`. Writes to any other key are refused. The machine has its own passport name `cnc-01.smartician.eth` and the AI technician has an agent identity `guide-cnc.smartician.eth`.

**World.** The worker checks in on their phone before putting the headset on. Our server starts a World device-authorization request and validates the signed ID token itself (signature, issuer, audience, expiry, freshness and method) using the `jose` library. The browser result is never trusted. Test mode and the licence stay locked until the server accepts it.

**Dashboard.** A React app built with Vite, Tailwind, Motion and a WebGL shader background. It shows a live event stream, the proof chain, an episode replay player, licence records, a live headset view and a public verify page.

**Things that were hard**
- The venue network stalled new connections to 0G, which showed up as false "unreachable" popups. We added short per-attempt timeouts with fresh-connection retries and a keep-alive request, and moved the backend to Railway. The hosted server then ran 32 consecutive judge calls with no safe-stops.
- The model's answers were being cut off by a token limit, which also caused safe-stops. We raised the limit and repair a reply that is complete except for its final closing brace. The schema still validates it.
- `qwen3.8-flash` does not support JSON mode, so the reply format is enforced by prompt and schema.

## 4. Links and addresses

- **Repository:** https://github.com/DakshKulkarni/Eth2026
- **Live demo:** https://eth2026.dakshkulkarni.in (public verify page: `/verify/d1-cert`; worker check-in: `/checkin`) **[confirm the dashboard is deployed before you submit]**
- **Demo video:** **[your video link]**

**Contracts**
- 0G Chain (Galileo testnet, chain id 16602): `SessionRegistry` `0xb0725934080eeE16A287FF752a41a2Ae4dFC5453`
- ENS on Sepolia (parent `smartician.eth`): CertificateRegistrar `0xC2144a25038786e7F9abB7935d1E4adBE3Edb5ee`, subname registry `0x4bFa2E837e3ffd84358B2B6632ECE3aE12197999`, resolver `0xD78075b4A8722064B4d41202E5dC1944709FC3B9`, issuer wallet `0x9fe0a744D928510A43D170c7f50e0f0e48754762`

**Proof you can click**
- Licence `d1-cert.smartician.eth` (valid until 2027-02-04), human proof `world:sandbox:5c998d836d89`
  - Issued: https://sepolia.etherscan.io/tx/0x832ebeca30edd28ae475cd892d1bacb1cf343e40694962f5a320a3572420c7ff
  - Evidence records written: https://sepolia.etherscan.io/tx/0xf608eff97f150c29eb99d5637541367d362707682cfed4a9dc7b9e8adbbffcdc
  - Profile records: https://sepolia.etherscan.io/tx/0xf37106dccf50744d0f8636cf4e89823d40b428bf593d9e65cb976b5d40817bbc
  - Human record: https://sepolia.etherscan.io/tx/0xbdb33130d2c1128529d4cd16f6fad8544fb9a6c82e2039ea2dedbc918e04ab54
- Its 0G evidence root `0x3fd33a0fdecc2844bcef2d61b5e7463821e6b974100b8d4f21dbd0668495acc0`, anchored at https://chainscan-galileo.0g.ai/tx/0x9a79a0b79e44934b6c20692123ef483cac96f0132832ad556ef93ab980099f62
- Earlier test passes: root `0x5be0b15b1f59d64d82a9b38a7098917046d04a8f389619f8e4263c8623640caf` (licence `da-cert`), anchor https://chainscan-galileo.0g.ai/tx/0x4a642a638ac0c2b5c1bb1e281bf8688cb6f946b1dc350165849a02e816f1f917

## 5. Partner prize answers

### 5.1 0G: Physical AI, Agents with a Body

**Where 0G is in the decision loop.** The AI technician's every decision runs on 0G Compute. After each worker action the headset sends the new actions and the machine state; at the four checkpoints it also sends a camera frame from the worker's point of view. The 0G model returns a verdict (ok, correct or unsafe) with a coaching line, and a checkpoint cannot be passed without it. Spoken corrections come from 0G text to speech. Safety interlocks (door open, E-stop) run on the device, so 0G is the brain at key checkpoints, not the spinal cord.

**Episode log on 0G Storage with a request id per decision.** Each session is stored as a hash-chained bundle. Every judge record carries its 0G request id, the model and the latency. Example: root `0x3fd33a0f…acc0` has 30 records, 26 AI verdicts and 1 voice line. The backend downloads it back from 0G Storage and re-verifies the chain.

**Anchored on 0G Chain.** `SessionRegistry` (`0xb072…5453`) stores each session's root hash and outcome. Anchor for the example above: `0x9a79a0b7…9f62`.

**Replayable simulation.** The whole machine is simulated in the headset. Any stored session can be replayed from its root hash in the dashboard, with a timeline, the machine's control panel following the recorded state, the procedure ticking off, and each verdict's request id.

**Safe-stop if 0G is unreachable.** The headset shows a red "Do not continue" panel with a Retry button and nothing unlocks. There is no offline stub and no local rule that can override or fake a 0G verdict.

**Not "0G only for logs".** The AI's decisions, the voice and the vision input all run on 0G. Storage and Chain make them auditable.

**Feedback for 0G**
- *What worked well:* the Router is OpenAI-compatible and returns a request id in `x_0g_trace`. Base64 image input worked on `qwen3.8-flash`. Latency on the hosted server was a median of about 2.7 s per verdict, with 0 safe-stops in 32 consecutive calls.
- *Friction:* `qwen3.8-flash` rejects JSON mode (HTTP 400 `model_not_capable`), so structured output had to be enforced by prompt and schema. Claude 5.5 models returned empty content until we set `reasoning_effort: low` and a larger token budget, because hidden reasoning used the limit. The text-to-speech endpoint path and request shape were not in the docs and had to be found by trial. The chain explorer's contract-address page redirected to the home page, so we linked transactions instead.
- *Highest-impact improvement:* document per-model capabilities (JSON mode, reasoning controls, token behaviour) in one table, and document the text-to-speech endpoint.

### 5.2 ENS: Best Use of ENSv2

**ENSv2 is central, not cosmetic.** The licence, the machine and the AI technician are all ENS names, and the product's behaviour depends on reading them live.
- **Hierarchical registry:** our own UserRegistry (deployed through the VerifiableFactory) is linked under `smartician.eth`. Licences are subnames of it.
- **Expiring and revocable:** a custom `CertificateRegistrar` lets only the issuer issue a licence (up to 365 days, 90 by default) and revoke it. A revoked or expired licence reads as invalid immediately.
- **Enhanced Access Control:** the issuer wallet holds only the registrar and unregister roles on the registry, and per-key `setText` roles on the resolver. It can write exactly `mrt.evidence`, `mrt.verdict`, `mrt.issuedAt`, `alias`, `description`, `class` and `mrt.human`. A scripted test showed it is refused on other keys such as `mrt.model`, `mrt.procedure`, `agent-context` and `mrt.approval`. The licence holder receives no roles.
- **Key-value records as the credential:** `mrt.evidence` is `0g://` plus the 0G Storage root, so the licence points to its own evidence. `mrt.human` records World proof, using the ENSIP-18 `alias` and ENSIP-27 `class` keys as well.
- **Agents as namespaces:** the machine has a passport name `cnc-01.smartician.eth` (model, procedure root hash on 0G, guide version) and the AI technician has its own identity `guide-cnc.smartician.eth`.

**Functional, not hard-coded.** The headset reads the machine passport live from ENS at start-up. The public verify page reads the licence from ENS at the moment you open it, and our dashboard revoke button flips a licence to invalid on Sepolia. Live demo and open-source code: see section 4.

### 5.3 World: ID Agent Pass

**What is protected.** Starting Test mode and issuing a licence. An AI technician is about to authorise a person to run a dangerous machine, so a real person has to be behind the attempt.

**The complete journey.** (1) The worker opens the check-in page on their phone and taps Verify with World. (2) Our server starts a World device-authorization request. (3) The worker approves in World's sandbox. (4) Our server validates the signed ID token: signature through World's published keys, issuer, audience, expiry, `auth_time` no older than this attempt, and the authentication method. (5) The headset's Test button now offers to start as the verified worker, and the session is bound to that check-in. (6) After a pass, the licence is issued from the same check-in, once, with an `mrt.human` record. A hash of the World ID, never the raw ID, goes into the 0G evidence and onto the licence.

**The unsuccessful path.** With no verified check-in, Test mode stays locked and the headset asks the worker to check in. A denied, expired or cancelled request, a forged or stale token, or World being unreachable all leave Test locked and no licence is issued. The certificate endpoint returns 403 without a verified check-in. We tested these cases (approve, slow-down, deny, forged signature, stale token, cancel, expiry, claim, retry, single use) against a local stand-in World server, and ran the real approval end to end in the sandbox.

**Validated in a secure backend.** The client secret lives only on the server. The browser result is never trusted. The device code and the World subject never leave the server.

**Why this credential is enough.** The decision only needs to know that one real person is behind this attempt, not who they are. A fresh sandbox proof with the Orb-class test credential gives that. We say plainly that sandbox identities are test identities.

**Integration debrief**
- *Time to first success:* **[your honest time, from first reading the docs to the first real approval]**. The slowest parts were portal and sandbox access, not the code.
- *Friction:* one Google account got `account_not_eligible` in the portal and another worked. The sandbox app showed "V4 protocol and credential issuance must both be enabled for this account", which isn't in the public docs. The device flow needs a registered redirect URI even though it never uses one. The prize page says proofs are mocked and no sandbox app is needed, while the sandbox docs describe installing one.
- *Missing capability or documentation:* the device profile has no binding message, so World's approval page cannot show what is being approved. The person sees only the requester and a code. The name "Agent Pass" appears only on the prize page, not in the public docs.
- *Highest-impact improvement:* show the action being approved on the approval page, or make the sandbox account setup flags enable themselves, with a clear fix shown when they don't.

## 6. AI tools disclosure

ETHGlobal asks you to say where and how AI was used. Write this accurately in your own voice. This draft is based on how the project was actually built:

- **Claude Code (Anthropic)** was the main coding assistant throughout, working from a written plan I directed. It wrote most of the first drafts of: the backend (`backend/src`), the Solidity contracts (`contracts/src`), the Unity C# scripts (`UnityProject/Assets/Scripts` and the editor scripts), the scripts in `backend/scripts`, the React dashboard (`dashboard/`), and the docs in `docs/`.
- **Meshy** **[confirm: you said you would generate the CNC model with Meshy]** was used to generate the 3D machine model. **[Also list any other generated assets, for example textures or the benchtop drill press model.]**
- **The 0G models** are part of the running product, not the development process: the judge and the voice.
- **What I did myself** **[edit to be accurate]**: chose the idea and the design, set up every account and key, ran the deployments and permission scripts, tested everything on the Quest 3, and made the decisions about the AI's role, the safety design, what to cut and how it should look.

**Planning files.** ETHGlobal says spec-driven workflows are allowed but their spec and planning files must be included in the repository. If your written plan counts as one, include it **[decide whether to add a cleaned copy to the repo before you submit]**.

## 7. What is new versus reused

Everything was written during the hackathon (the first commit is 5 Nov 22:11, and there are 32 commits). Third-party and open-source pieces: Meta XR SDK, glTFast, Newtonsoft.Json and TextMeshPro in Unity; Fastify, zod, ethers, viem, jose and the 0G Storage SDK in the backend; React, Vite, Tailwind, Radix, Motion and ogl in the dashboard; partner-provided ENSv2 contracts and implementations from the ENS deployment. The 0G, ENS and World marks used on the dashboard come from each project's documentation or an open icon set and remain their owners' trademarks.

## 8. Team

- **Name(s):** **[your name]**
- **Telegram:** **[handle]**   **X:** **[handle]** (0G requires both for the team)

## 9. Before you press submit

1. **Add a README.** There is none in the repo root, and 0G requires a README with setup instructions.
2. **Deploy the dashboard** and check `/`, `/verify/d1-cert` and `/checkin` on the live domain. The live demo link must work for both 0G and ENS.
3. **Make sure the last commit matches what is deployed.**
4. **Record the video** (2:00 to 2:59, 720p or better, your own voice, not a phone).
5. **Pick the three partner prizes** (0G, ENS, World) and paste sections 5.1 to 5.3 into their boxes.
6. Choose the submission option: **Finalist and Partner Prizes** (you present in a 4-minute demo plus 3-minute Q&A) or **Partner Prizes only**.
7. Re-read section 6 and edit it so it is accurate and in your own words.
