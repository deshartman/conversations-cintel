# CLAUDE.md

Owl Airlines voice + SMS AI agent demo (JS port of a Python original). Inbound Voice and SMS go
through Twilio Agent Connect (TAC) into one OpenAI tool-calling agent, with Conversation Memory
context and a small in-memory dashboard.

Project conventions, scope and module map live in @AGENTS.md. Read it first; this file adds only
what isn't written there.

## Commands

```bash
npm install
npm run preflight             # read-only: env vars, both credentials, Conversations terms accepted
npm start                     # = npm run dev; Fastify on $PORT (default 8000)
npm run setup                 # Memory Store + Orchestrator config + profile/traits + phone Voice URL; writes IDs to .env
npm run profile               # re-seed only Avery Stone's Memory profile (needs TWILIO_MEMORY_STORE_ID)
npm run setup:phone-number    # point TWILIO_PHONE_NUMBER's Voice URL at https://$TWILIO_VOICE_PUBLIC_DOMAIN/twiml
npm run setup:cleanup         # dry run; :apply actually deletes
npm run profile:cleanup       # dry run; :apply actually deletes
```

There are **no tests, linter, or build step**, and **the app cannot boot offline**. At startup TAC
fetches the Orchestrator Configuration from Twilio, so dummy credentials fail with a 401. With a real
`.env`, verify by booting `npm start` and hitting `GET /healthz`, `GET /api/conversations`, or `/`.
For offline checks, import modules directly, e.g.
`node -e "import('./src/tools/registry.js').then(r => console.log(r.allSchemas().map(s => s.function.name)))"`.

## Env vars: who actually reads what (verified against twilio-agent-connect 2.4.0)

- **TAC `fromEnv()` hard-requires** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`,
  `TWILIO_API_SECRET`, `TWILIO_PHONE_NUMBER`.
- `TWILIO_CONVERSATION_CONFIGURATION_ID` is effectively required too. Without it TAC enters
  voice-only mode and `new SMSChannel` throws. It must match `^conv_configuration_[0-9a-z]{26}$`.
- TAC also reads `TWILIO_VOICE_PUBLIC_DOMAIN` and optional `TWILIO_MEMORY_*` tuning vars.
- `TWILIO_MEMORY_STORE_ID` / `TWILIO_MEMORY_PROFILE_ID` are read **only by the helpers**. At runtime the
  Memory Store comes from the Orchestrator Configuration.
- `TWILIO_MEMORY_PROFILE_TRAIT_GROUPS` (`Loyalty,Travel`) is read by TAC (which trait groups to load)
  and by `helpers/profile/0_cleanup.js` (which groups to delete).
- TAC 2.4 sends usage telemetry by default (account SID, channel, conversation ID, timings; no
  content or phone numbers). Set `TAC_ANALYTICS_DISABLED=true` to turn it off.
- App-only: `OPENAI_API_KEY`, `OPENAI_MODEL`, `PORT`, `DEMO_CALLER_PHONE_NUMBER`, optional
  `TWILIO_MESSAGING_SERVICE_SID`.
- `TWILIO_INTELLIGENCE_CONFIGURATION_ID` is read by the helpers and, when it is a real ID (not
  `xxxx`), copied by `src/server.js` into `TWILIO_TAC_CI_CONFIGURATION_ID` (the name TAC's
  `fromEnv()` reads) before TAC starts. Then `src/server.js` passes
  `webhookPaths: { cintel: '/ci-webhook' }` to TAC; otherwise `/ci-webhook` returns 404. TAC only
  processes results from this one Intelligence configuration, but the dashboard capture hook
  (`src/services/capture.js`, a `preValidation` hook that runs before TAC's signature check) stores
  every operator result regardless. `TWILIO_TAC_CI_SUMMARY_OPERATOR_SID` is optional.

## Request flow

```
Voice: number webhook -> POST /twiml (TAC) -> <ConversationRelay conversationConfiguration=...> -> WS
SMS:   Orchestrator capture rule -> statusCallbacks -> POST /webhook (TAC)
both -> tac.onMessageReady -> handleMessageReady (src/services/agent.js)
        -> MemoryPromptBuilder.compose(SYSTEM_INSTRUCTIONS, memory, session)  # system msg reset each turn
        -> runToolLoop (<= MAX_TOOL_ITERATIONS=5 OpenAI chat.completions calls)
        -> return string = reply TAC speaks/sends
CI:    Intelligence rule (live trigger, webhook action) -> POST /ci-webhook (TAC, if enabled)
        -> capture hook -> GET /api/sessions/:id/events -> dashboard Intelligence panel + Events timeline
        -> next turn: intelligenceNote() in the system prompt -> offer_recovery_coupon tool
```

- Coupon: `src/tools/coupon.js` issues one fake coupon per conversation, only while the latest
  `offer-coupon` result is true. CI results arrive after the turn that produced them, so the agent
  offers it on the caller's *next* message.

- `src/server.js` owns the Fastify instance, registers `/static/*` + dashboard routes, then hands
  Fastify to `TACServer`. TAC adds its own `/twiml`, `/ws`, `/webhook`, and
  `/conversation-relay-callback` routes. Don't collide with them.
- Voice channel: `memoryMode: 'once'`. SMS: `memoryMode: 'always'`.
- Per-conversation OpenAI history is a module-level `Map` in `agent.js`. It is never pruned, and
  restarting the process is the "reset". Dashboard state lives in `src/repositories/conversations.js`.
- Tools receive `(args, { context })` where `context` is the full TAC event. `sms.js` reads the
  caller address from `context.authorInfo.address` (with fallbacks), else `DEMO_CALLER_PHONE_NUMBER`.
- Tool errors are caught and returned to the model as `{ error }`. They never throw out of the loop.

## Gotchas

- **Never point the phone number's SMS webhook at the app.** SMS arrives via Orchestrator
  `statusCallbacks` only. A number/Messaging Service webhook to `/webhook` causes
  `Invalid webhook payload` errors. See RUNBOOK_SETUP.md §6.4.
- **No passive VOICE capture rules** in the Orchestrator config (double STT billing). See AGENTS.md.
- Testing SMS from `twilio dev-phone` in the *same* account produces duplicate Communications and two
  replies. That comes from intra-account testing, not from the code.
- Two Twilio auth modes: the **app** (`src/tools/sms.js`) uses `TWILIO_API_KEY`/`TWILIO_API_SECRET`.
  The **helpers** (`helpers/common.js`) use `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`.
- New accounts must accept the **Conversations terms of service** separately. Until they do, every
  control-plane call returns 401 `20003` while Messaging keeps working. `npm run preflight` catches it.
- The Twilio SDK's `client.request()` **does not throw on 4xx/5xx**. `twilioRequest` in
  `helpers/common.js` checks `statusCode` itself, so keep that check if you refactor it.
- Helpers call control-plane REST hosts directly via `client.request` (`memory.twilio.com/v1`,
  `conversations.twilio.com/v2`, `intelligence.twilio.com/v3`). Async creates return a `statusUrl`
  polled by `waitForOperation`.
- Recall is indexed asynchronously, so wait ~30s after seeding observations before testing memory.
- Account limits: 10 Orchestrator Configurations, 15 Memory Stores.

## Known doc/code mismatches (don't "fix" silently, but mention them if relevant)

- `npm run setup` skips Intelligence (steps 3-4) unless the `TWILIO_INTELLIGENCE_*_OPERATOR_ID` vars
  (absent from `.env.example`) are set. For the demo, Intelligence is set up **manually in the
  Console** following `assets/conversation-intelligence.md`.
- `npm run setup` reuses any real ID already in `.env` and only writes keys that are missing or still
  contain `xxxx`. To provision fresh resources, reset those keys to placeholders first.
- `helpers/setup/2_create_conversation_config.js` sets `statusCallbacks` to
  `https://$TWILIO_VOICE_PUBLIC_DOMAIN/webhook` only on create. Setup reuses an existing config, so a
  config made earlier (or a changed tunnel URL) needs it added in the Console or via API.
- `SYSTEM_INSTRUCTIONS` hardcodes the Avery Stone scenario and lists tools by name. Keep it in sync
  when adding or removing tools.

## Project skills

- `.claude/skills/add-agent-tool`: add a new OpenAI tool (schema + handler + registry + prompt).
- `.claude/skills/twilio-provision`: step-by-step live-demo provisioning, statusCallbacks, closing
  conversations, reset, and teardown.
- `.claude/skills/owl-air-policies`: luggage/pet KB facts, demo questions, and how to wire them in.
- `.claude/skills/troubleshoot-demo`: diagnose Voice/SMS/Memory failures in a running demo.

`assets/knowledge/` holds the two Owl Air KB articles (luggage, pet policy).
`.claude/plans/helpers/` holds the original bash helpers from the Python version. Treat them as
reference only. The JS `helpers/` are the ones to run.
