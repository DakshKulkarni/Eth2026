# Verified facts

Read on 2026-11-05. Items marked UNRESOLVED need a human decision or a first live call.

## 0G Private Computer (Compute Router)

- Mainnet base URL: `https://router-api.0g.ai/v1` (UI: pc.0g.ai). Testnet: `https://router-api-testnet.integratenetwork.work/v1` (UI: pc.testnet.0g.ai). Separate balances and keys.
- Auth: `Authorization: Bearer sk-...`. `mk-...` keys are management only (balance, key admin), not for inference.
- `GET /v1/models` is public (no key). `GET /v1/providers?model=<id>` lists TEE providers.
- Chat: `POST /v1/chat/completions`, OpenAI-compatible. Extras: `verify_tee`, `plugins`, `X-0G-Provider-*` headers.
- Request ID: response body field `x_0g_trace.request_id`. No response header documented.
- JSON mode: `"response_format": {"type": "json_object"}` on models whose `supported_parameters` include `response_format`.
- Thinking off: Qwen and DeepSeek models list `enable_thinking`; GLM and 0gm models take `chat_template_kwargs: {"enable_thinking": false}`. Passing the right one per model is needed.
- Live model IDs (from `/v1/models`):
  - Judge candidates: `qwen3.5-flash`, `qwen3.5-35b-a3b`, `qwen3.6-flash`, `qwen3.7-flash`, `qwen3.8-flash`. All list `response_format` and `enable_thinking`.
  - STT: `whisper-large-v3` (params: file, model, language, response_format).
  - TTS: `minimax-speech-02-turbo`, `minimax-speech-02-hd`, `minimax-speech-2.6-turbo`, `minimax-speech-2.6-hd`, `minimax-speech-2.8-turbo`, `minimax-speech-2.8-hd`.
- STT: `POST /v1/audio/transcriptions`, multipart with `file`, `model`, optional `response_format` (json|text|srt|verbose_json|vtt), `language`, `prompt`, `temperature`. JSON reply has `text`. The docs example writes the model as `openai/whisper-large-v3`, the live list says `whisper-large-v3`: use the live ID.
- UNRESOLVED: TTS endpoint path and request shape (not documented; likely `/v1/audio/speech`, unconfirmed). Request ID location on STT/TTS responses. Free-tier or deposit needed before the first call. Needs a key from pc.0g.ai to test.

### Verified live (2026-11-06, with a real key)

- Chat: `POST {router}/chat/completions` works. Success replies carry `x_0g_trace.request_id`; error replies carry a top-level `request_id`. `enable_thinking: false` (top level) is accepted by `qwen3.8-flash`.
- `qwen3.8-flash` does NOT support `response_format: json_object` (HTTP 400 `model_not_capable`). Ask for JSON in the prompt and validate with a schema.
- Latency: tiny prompt 2.4 s; coach prompt with full SOP 4.4 s; same with a 512x288 JPEG frame 3.6 s.
- Image input: base64 `data:image/jpeg;base64,...` in an `image_url` part works on `qwen3.8-flash`.
- Speech: `POST {router}/audio/speech` with `{model, input, voice, response_format:"wav"}` returns `audio/wav`; request IDs are in the `x-request-id` response header. `minimax-speech-02-turbo` about 4.6 s, `-2.6-turbo` about 4.6 s, `-2.8-turbo` about 6 s.
- Coach model benchmark (same deliberate-mistake request, 2 runs each): `qwen3.5-flash` about 2.7 s with 9 to 11 word lines (chosen), `qwen3.8-flash` about 3.6 s, `gemini-3.1-flash-lite` about 3.2 to 4.2 s, `glm-5.3-flash` failed with the strict JSON schema (safe_stop).
- Coach model benchmark v2 (4 scenarios: mistake, correct stage, harmless reorder, unclamped door; 0G is the only judge, actions given as readable lines): `qwen3.8-flash` 12 of 12 correct over 3 runs, 1.3 to 3.9 s, price x1 (chosen); `claude-sonnet-5.5` 8 of 8, 2.6 to 3.8 s, x10; `claude-opus-5.5` 4 of 4, 4.2 to 5.8 s, x21; `claude-haiku-5.5` 11 of 12 (one safe_stop from an invalid reply), 2.4 to 5.5 s, about x0.6; `gpt-6.1-terra` 4 of 4, 4 to 7 s, x5; `gpt-5.5` 4 of 4, 4 to 12 s, x26; `gpt-5.2` 2 of 4 (false alarms); `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-4.1-mini` and `gpt-5.6-luna` weaker or too slow. Small sample, not a proof.
- Claude 5.5 models on `/chat/completions` spend the output budget on hidden reasoning (empty content, `finish_reason: length`). Fix: `reasoning_effort: "low"` with `max_tokens` 400 for haiku-5.5 and sonnet-5.5; a 1500 budget for other Claude and for gpt-5/6 models. Claude and GPT models reject nothing else we send, but do not get `enable_thinking` or `temperature`.
- Typical end to end from mistake to spoken correction: about 6 to 7 s (judge about 2.7 s, then speech about 3 to 4 s).

## 0G Storage and Chain

- Package `@0gfoundation/0g-storage-ts-sdk` with `ethers`.
- Testnet (Galileo): chain ID `16602`, RPC `https://evmrpc-testnet.0g.ai` (dev only), explorer `https://chainscan-galileo.0g.ai`, faucet `https://faucet.0g.ai` (0.1 0G per wallet per day).
- Storage indexer (turbo): `https://indexer-storage-testnet-turbo.0g.ai`.
- Upload: `new Indexer(indexerUrl)`, `new MemData(Uint8Array)`, `await memData.merkleTree()`, `const [tx, err] = await indexer.upload(memData, RPC_URL, signer)`. Result holds `rootHash` and `txHash`.
- Download: `indexer.download(rootHash, outputPath, true)` returns `err`; writes with `fs.appendFileSync` (Node only). `indexer.downloadToBlob(rootHash, {proof, decryption})` returns `[blob, err]`.

### Evidence trail design (built and verified live 2026-11-06)

- Live result of `npm run smoke:evidence`: an 841-byte bundle uploaded to 0G Storage (root hash `0x6b1a9ace...59ade`, storage tx `0x5bccc90c...6459b`), anchored on 0G Chain (tx `0xb6b22d96...a1414`, explorer https://chainscan-galileo.0g.ai/tx/0xb6b22d9664837ebbbc0bce61bb567682b1fb7ddfce9840ebcaf5ab01f66a1414), the contract read-back matched the root hash and outcome, and the bundle downloaded with proof and verified (2 records, head hash matched).
- Storage fee for that upload was 122934579848 neuron (about 0.0000001 0G). Storage nodes needed about three sync waits before accepting the file; the download worked on the first attempt.

- Episode log: hash-chained records (`prevHash`, sha256 over canonical JSON) for `session_start`, every `observe` (state, new actions, frame sha256, verdict, mistakes, request ID, model, latency, safe-stop reason), every `speech` request ID, and `session_end`. Frames are hashed, never uploaded.
- Bundle verification rejects an edited, deleted or reordered record (tested offline with `npm run smoke:episode`).
- Upload: `Indexer.upload(MemData, rpc, signer)` returns `[{txHash, rootHash, txSeq}, error]`; download for verification uses `downloadToBlob(rootHash, {proof: true})`. The SDK's types come from the CommonJS build of ethers, so the signer needs one typed cast.
- Registry contract `contracts/src/SessionRegistry.sol` (issuer-only `anchor(sessionId, rootHash, outcome)`, event `SessionAnchored`, one anchor per session). Outcome codes: 1 learn_complete, 2 test_pass, 3 test_fail, 4 abandoned. Compiled with solc-js, EVM target `paris` to avoid opcodes a chain may not support; Foundry is not installed here.
- `POST /session/:id/finalize` never fakes a hash: with no wallet or a failed upload it returns 502 `storage_unavailable`; if only the anchor fails it returns the real root hash plus `anchorError`.

### Explorer links (verified in the browser 2026-11-06)

- Chain transaction: `https://chainscan-galileo.0g.ai/tx/<txHash>` shows status, the registry contract in "To", and the root hash in the input data. `/address/<contract>` redirected to the home page, so it is not used.
- Storage file: `https://storagescan-galileo.0g.ai/submission/<txSeq>` shows the file hash (our root hash), size, base fee, sender, L1 tx and time. The `txSeq` comes back from `Indexer.upload`, and `POST /session/:id/finalize` now returns it as `storageTxSeq` plus ready-made `links.storage` and `links.anchor`.
- Registry contract on Galileo: `0xb0725934080eeE16A287FF752a41a2Ae4dFC5453`.
- DASHBOARD REQUIREMENT (from the user): the web dashboard must show, live, the proof that storage and logging happened: the episode records as they are written, the 0G Storage root hash, the anchor transaction, and clickable links to both explorers, so a judge can verify in one click.

## ENSv2 (Sepolia)

- Permissioned Registry: `register(label, owner, registry, resolver, roleBitmap, expiry)`, `renew(anyId, newExpiry)`, `unregister(anyId)`, `revokeRoles(anyId, roleBitmap, account)`, `revokeRootRoles(roleBitmap, account)`. Expired when `block.timestamp >= expiry`.
- Registry roles: `ROLE_REGISTRAR` 1<<0, `ROLE_REGISTER_RESERVED` 1<<4, `ROLE_UNREGISTER` 1<<12, `ROLE_RENEW` 1<<16, `ROLE_SET_SUBREGISTRY` 1<<20, `ROLE_SET_RESOLVER` 1<<24. Admin variant is `role << 128`.
- Revoke a certificate: `unregister(anyId)` (needs `ROLE_UNREGISTER`). It makes the name available at once, so `/credential` can treat a missing name as revoked.
- Permissioned Resolver: `setText(bytes name, string key, string value)`, `multicall(bytes[])`, `grantSetterRoles(bytes setter, address account)` (argument-scoped, setter is ABI-encoded calldata, caller needs the admin role), `grantRootRoles`, `revokeRootRoles`, `revokeRoles(resource, roleBitmap, account)`.
- Text roles: `ROLE_SET_TEXT` 1<<4, admin `(1<<4)<<128`. A key's resource is `keccak256(bytes(key))`. This is the per-key delegation for the guide, approver and worker accounts.
- Sepolia addresses: RootRegistry `0xb458d6a3a77919449d03e7a6903c26827c1ec43f`, ETHRegistry `0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4`, ETHRegistrar `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3`, VerifiableFactory `0xda70306c98e97ece36f997a21368e53298572991`, UserRegistryImpl `0x9bd8a88719068d09ecee662f36c0e3856708366a`, PermissionedResolverImpl `0x115eb53f0c60696633855f90b138178fb40b2b2c`, UniversalResolverV2 `0x24e1d8e068620b647ca097f961a61055f4f42d72`, MockUSDC `0x240b0316df57887dbbe58b586508b19e633a14aa`. Full table: docs.ens.domains/learn/deployments#sepolia-ensv2.
- Conflict to check: the ENS learn page names a different test USDC (`0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e`) than the deployments table MockUSDC above. Use the deployments table and verify on-chain before minting.
- Resolution: libraries with ENSv2 support go through the Universal Resolver automatically. Smoke test: resolve `ur.integration-tests.eth`; `0x2222...` means v2 works, `0x1111...` means the library is outdated. Never hard-code the Universal Resolver address in app code.
- Facts pass 2 (read from the ENS docs 2026-11-06):
  - Parent name: register `<label>.eth` on the ETHRegistrar with commit-reveal: `makeCommitment(label, owner, secret, subregistry, resolver, duration, referrer)`, `commit(hash)`, wait at least 60 s (commitment valid up to 24 h), then `register(label, owner, secret, subregistry, resolver, duration, paymentToken, referrer)`; pay in MockUSDC (free `mint`, must `approve`). 5+ character names cost $8/yr. `isAvailable(label)` is confirmed working on Sepolia.
  - Subname registry: deploy a UserRegistry proxy with `VerifiableFactory.deployProxy(implementation, salt, initData)` (`initialize((address account,uint256 roleBitmap)[] grants)`, `ALL_ROLES = 0x1111...1111`); then the parent owner calls `setSubregistry(labelhash, userRegistry)` on the ETHRegistry. Without that link the subnames do not resolve.
  - Registrar pattern: a plain contract calls `registry.register(label, owner, IRegistry(0), resolver, roleBitmap, expiry)` (absolute expiry), `renew(anyId, newExpiry)`, `unregister(anyId)`. The registry owner grants it `ROLE_REGISTRAR` (1<<0), `ROLE_RENEW` (1<<16) and `ROLE_UNREGISTER` (1<<12) with `grantRootRoles(bitmap, account)`; the granter needs the `_ADMIN` variants (role << 128) from `initialize`.
  - Credential state: `getState(labelhash)` returns `{status (0 available, 1 reserved, 2 registered), expiry, latestOwner, tokenId, resource}`. A certificate is valid only if status is 2 and expiry is in the future; `unregister` flips it to available at once.
  - Records: deploy a PermissionedResolver proxy per account with the factory (`initialize((address account,uint256 roleBitmap)[] grants, bytes[] calls)`). `setText(bytes dnsName, string key, string value)` takes a DNS-encoded name (viem `packetToBytes`). Scope one writer to one key with `grantSetterRoles(encodedSetTextCall(0x,key,""), account)`; revoke with `revokeRoles(keccak256(bytes(key)), ROLE_SET_TEXT, account)`. Scoped grants apply to every name served by that resolver, so separate writers needing different names need separate resolver instances. Reading uses viem `getEnsText` through the Universal Resolver.
  - ENSIP-26: `agent-context` text key plus `agent-endpoint[<protocol>]` give an AI agent an ENS identity; ENSIP-25 uses `agent-registration[<registry>][<agentId>]`.
  - Sepolia: chain id 0xaa36a7; the public RPC `https://ethereum-sepolia-rpc.publicnode.com` works and the ETHRegistry has code.
  - Candidate parent names confirmed available on Sepolia: mrtrainer, mrmachinetrainer, cnctrainer, machinetrainer, trainmr, ethmumbaitrainer.
  - STILL TO CONFIRM while building: that the installed viem resolves ENSv2 names on Sepolia (test with `ur.integration-tests.eth`); exact function signatures of the deployed UserRegistry and PermissionedResolver (read from the contracts if a call reverts).

### ENS live deployment (Sepolia, built and verified 2026-11-06)

- Parent `smartician.eth` (ENSv2, owner `0xa957e92Cf962f58A0a1b9F0464008c43BB2226f2`). Deployed by `npm run ens:setup`, saved in `backend/deployments/sepolia.json`: PermissionedResolver proxy `0xD78075b4A8722064B4d41202E5dC1944709FC3B9`, UserRegistry proxy `0x4bFa2E837e3ffd84358B2B6632ECE3aE12197999`, CertificateRegistrar `0xC2144a25038786e7F9abB7935d1E4adBE3Edb5ee` (issuer-only: AGENT wallet `0x9fe0a744D928510A43D170c7f50e0f0e48754762`).
- Names: `cnc-01.smartician.eth` (machine passport: `mrt.model`, `mrt.procedure` = `0g://` plus the real 0G Storage root hash of the procedure, `mrt.guide`, `mrt.guideVersion`, `description`) and `guide-cnc.smartician.eth` (`agent-context` per ENSIP-26, `mrt.model`, `mrt.guideVersion`). Procedure root hash `0x2384662932234e5d389e2c66b79d86dafee463f8a10c33f49f8c655aedaf540c`.
- Reading: viem 2.57.16 resolves these names with its default Sepolia settings through the canonical Universal Resolver (`getEnsText`), and also through the V2 and managed resolver addresses.
- Certificates: `CertificateRegistrar.issue(label, holder, expiry)` (max 365 days, holder gets no roles, so the token cannot be transferred or edited by the holder) and `revoke(label)` (unregister). The issuer writes its three records in one `multicall`.
- Live test (`npm run smoke:ens`): issued `cert-smokemw49ut8i.smartician.eth` (issue tx `0x3d6dad68be6e82f7e129cc173db36b44cbd4767b39bda4b45812b7ab61cd5069`, records tx `0xdcfbfc8676639d2db405049c9106a04a12facd7b63cc71e769fce55722f39435`), the credential check returned valid with its records, then revoked (tx `0x0a9a629c51c4605fb52f3563807c0d8c6d4618d53ef915ef9b33e40a216083ab`) and the same check returned invalid at once.
- Scoped writes (`npm run smoke:ens-scope`, simulated calls): the issuer wallet is allowed `mrt.evidence`, `mrt.verdict`, `mrt.issuedAt` and refused `mrt.model`, `mrt.procedure`, `description`, `agent-context`, `mrt.approval`. `mrt.approval` is reserved for the APPROVER wallet (World step, not built yet).
- Backend endpoints: `GET /machine/:label`, `GET /credential/:label` (certificate labels only), `POST /credential/:label/revoke` (optional `x-admin-token` header when `ADMIN_TOKEN` is set), `POST /session/:id/certificate` (only after a finalized `test_pass` session; NOT yet gated by a World approval).

## World ID (auth.world.org)

- World's docs describe an OIDC provider, issuer `https://auth.world.org`, discovery `/.well-known/openid-configuration`, portal login with Google, client secrets prefixed `worldidp_client_secret_`, auth methods `client_secret_basic|client_secret_post|private_key_jwt`, ID tokens RS256 via JWKS.
- Callbacks must be HTTPS with exact match, no wildcards. A tunnel or the final subdomain is needed; the LAN address will not work for the redirect.
- Fresh approval: `max_age=0` plus an essential `acr` claim request (Orb class is `https://world.org/oidc/acr/orb`). Denied, cancelled, failed validation and expiry leave the action blocked. Retrying or status checks must not extend expiry.
- Headless agents use a device authorization flow; mobile approves, polling returns `access_denied` on failure. Pages mentioned: Sandbox and testing, Authentication (OIDC).
- NAME GAP: public docs never say "Agent Pass"; the matching mechanism is the Device Authorization Grant (RFC 8628, "Agent access"). It has no `approvalId` or QR API: the backend builds `approvalId` itself and renders the QR from `verification_uri_complete`.
- Device flow: POST form-encoded `scope=openid` (confidential client auth) to `https://auth.world.org/api/v1/device_authorization`; response has `device_code` (keep server-side), `user_code`, `verification_uri`, `verification_uri_complete`, `expires_in` (20 min), `interval`. Poll the token endpoint with `grant_type=urn:ietf:params:oauth:grant-type:device_code`. No callback, PKCE or state. Fresh authentication is always required. Approval page shows only requester and user code; `binding_message` is unsupported.
- Poll outcomes: `authorization_pending` (wait), `slow_down` (+5 s), `access_denied` / `expired_token` / `invalid_grant` (stop, no approval), 503 is never approval, 429 can end the attempt. No separate "cancelled" code: map cancel to the backend's own state. Validate the ID token (signature, issuer, audience, expiry, `auth_time`, `acr`, `amr`); device tokens omit `nonce`.
- Redirect URI is still required at registration for device-only clients, but is not used, so a placeholder is fine and no tunnel is needed for World.
- Sandbox: issuer `https://sandbox.auth.world.org`, own discovery, own portal, own credentials and World IDs. Needs the sandbox World ID app (iOS TestFlight invite via a World contact, then Add proof of human > Manual verify with a selfie, about 1 hour to issue). OAuth Playground: https://oauth-playground.toolsforhumanity.dev/ runs device flow against the sandbox. Sandbox results do not prove real Orb verification; never claim it.
- Guides are readable without sign-in; `coding-agent-setup` also offers a developer MCP server (`https://auth.world.org/mcp/developer`, sandbox `https://sandbox.auth.world.org/mcp/developer`). Not added.
- Portal (seen 2026-11-05): an `.edu.in` Google account passed where another gave `account_not_eligible`. Portal tabs: Apps, Agents. Create-app form fields: name, logo URL, Redirect URIs (exact HTTPS, one per line, one per environment), auth method (default Client secret Basic, immutable), default accepted accounts (Orb, Selfie Check, Any account), optional Face Auth, advanced subject identifiers. The form states each device connection needs phone approval plus a fresh World ID proof.
- Live discovery (both environments): endpoints are `<issuer>/api/v1/authorize`, `/api/v1/token`, `/api/v1/device_authorization`, jwks at `/.well-known/jwks.json`. Device grant is advertised by both. Token-endpoint auth: client_secret_basic, client_secret_post, private_key_jwt. Only two acr values exist (Orb, Orb-face), so an "Any account" client returns tokens with no `acr`; the backend must not require it in that mode. Sandbox also lists `offline_access` and token-exchange (XAA, not used).
- Client auth for the device endpoint and polling uses the registered method (Basic header by default). Secret prefix `worldidp_client_secret_`; never log request bodies or Authorization headers.
- Failure-path expectations from the testing guide: cancel or expire before approval grants nothing; a result bound to another attempt fails validation; a consumed device code cannot be redeemed twice; an error or unknown outcome is never treated as success. Our backend must keep one-use semantics for certificate issuance.
- Not found anywhere in public docs: "Agent Pass", an Agents-tab guide, env var names (we choose ours: WORLD_ISSUER, WORLD_CLIENT_ID, WORLD_CLIENT_SECRET), a portal-side device-grant switch.
- UNRESOLVED (needs a person): contents of the portal Agents tab; which environment the prize judges expect; sandbox portal URL (docs link it, path not read); sandbox app access depends on a World contact. The portal screenshot seen was production.

## Meta Quest / Unity

- Unity project currently has only URP, Input System and built-in modules. No Meta XR SDK, no Newtonsoft JSON, no glTFast installed.- Installed 2026-11-06: Unity 6000.3.28f1, `com.meta.xr.sdk.all` 207.0.1 (core, interaction, audio, haptics, platform, voice, mrutilitykit), Newtonsoft 3.2.2, glTFast 6.20.0. Unity also added `com.unity.xr.openxr` 1.16.1. Editor log showed 0 compile errors after import.
- Quest build quirk: with Unity OpenXR (`com.unity.xr.openxr`) plus Meta XR SDK, Gradle fails with "2 files found with path lib/arm64-v8a/libopenxr_loader.so" (OVRPlugin vs openxr_loader) unless **Meta XR Feature** is enabled for Android under Project Settings > XR Plug-in Management > OpenXR. Meta's `OVRGradleGeneration.cs` then excludes the other loader from the build. The asset showed `MetaXRFeature Android` disabled by default.
- Building Block names (menu labels): "Camera Rig", "Passthrough", "Controller Tracking", "Hand Tracking". Block data lives in `com.meta.xr.sdk.core/Editor/BuildingBlocks/BlockData`.
- `OVRCameraRig` (read-only Transform properties): `trackingSpace`, `centerEyeAnchor`, `leftHandAnchor`, `rightHandAnchor`, `leftControllerAnchor`, `rightControllerAnchor` (plus Detached hand variants).
- `OVRInput.Button`: `PrimaryIndexTrigger` and `PrimaryHandTrigger` map to the controller named in the call (use `OVRInput.Controller.RTouch` for the right index trigger, `LTouch` for the left grip). `One`, `Two`, `Three`, `Four` map to A, B, X, Y.
