# World integration log

Running record for the submission debrief. Facts only; the final write-up is the author's.

## 2026-11-05
- Read the World ID docs (OIDC provider, device authorization, step-up). Public docs do not use the name "Agent Pass".
- First portal sign-in with one Google account returned `account_not_eligible`; a different Google account passed. Portal access depends on which Google account is used.
- Needed the World ID app and an account on a phone to approve requests; the laptop cannot do this alone.

## 2026-11-06
- Found two separate World prizes on the ETHGlobal prizes page: World ID Agent Pass and Best Use of IDKit. The Agent Pass text says proofs are mocked and the sandbox app is no longer needed. Chose Agent Pass because the device-flow client already existed and judges can try it without a World app.
- First design had the headset show a QR for a supervisor to approve. Dropped it: nobody can scan a QR from inside the headset, and a supervisor was not the point.
- Final design: the worker proves they are human on their phone before putting the headset on (`/checkin`), using the Device Authorization Grant started by our page. Test mode and the licence are the protected action.
- Built the backend: check-in store, `/checkin` routes, `/worker/ready`, `/session/:id/claim`, a gate on the certificate route, and the proof of human written into the 0G episode log and an `mrt.human` ENS record.
- The signed ID token is validated server-side: RS256 signature through the published keys, issuer, audience, expiry, `auth_time` not older than this attempt, `amr` present. Device tokens omit `nonce`, which the docs say to accept.
- Checked against a stand-in World server (`npm run smoke:world`): approve, slow_down then approve, deny, forged signature, stale `auth_time`, cancel, expiry, claim, retry, single use, and no leaking of the device code or subject.
- Doc gaps so far: the device profile has no binding message, so the approval page cannot show what is being approved (the person sees only the requester and a user code); the device grant still needs a registered redirect URI it never uses; public docs use the name "Agent Pass" only on the prizes page.
- Not yet done: a real portal client, a real approval, the headset run.
