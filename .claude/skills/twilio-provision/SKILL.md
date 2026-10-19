---
name: twilio-provision
description: Live-demo driver for provisioning the Owl Airlines Twilio account - Memory Store, Orchestrator Configuration (+ statusCallbacks), Avery Stone profile, verify Recall, close conversations, reset and teardown. Use when the user says "set up the account", "next step", "create the memory store", "seed Avery", "reset the demo", "close the conversation", or asks what a provisioning step does.
---

# Provision the demo account (live, step by step)

The user runs this **on stage**. Go one step at a time:
1. Say what the step creates and why (one or two sentences the presenter can say aloud).
2. Show the exact command and **wait for a go-ahead**. Every step creates or deletes billable
   resources in a live account.
3. Run it, then pull out the new ID and offer to write it into `.env`. Show the line to the user
   first, and never print secrets back.
4. Tell them what comes next.

Helpers authenticate with `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` from `.env` (`ENV_FILE=` overrides).
Every helper logs the request body, so the output itself can be shown on screen.

## Preflight (read-only, safe to run unprompted)

- **Always run `npm run preflight` first**, including on a fresh account or before going on stage.
  It probes Orchestrator and Memory with **both** credentials (the auth token for the helpers, the
  API key for TAC). `npm run setup` and `npm run profile` also run it as step 0.
  - **`20003 Terms of service have not been accepted`** on a new account: the Conversations products
    have their own no-cost terms gate, separate from the account's terms, and Messaging still works
    while they're blocked. Fix it in the Console: Conversation Memory → Overview → "Upgrade your account
    for full access" → accept, and check Conversation Orchestrator too (RUNBOOK_SETUP.md §2.2). The
    user has to do this; you can't. It's worth showing on stage as part of the manual walkthrough.
  - 401 on the API key only: wrong `TWILIO_API_SECRET`, or a key from another account.
- `.env` has `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`,
  `TWILIO_PHONE_NUMBER` (E.164), `DEMO_CALLER_PHONE_NUMBER` (E.164, the phone Avery calls from),
  `TWILIO_VOICE_PUBLIC_DOMAIN` (current tunnel host, no scheme), `OPENAI_API_KEY`.
  Print key names and whether each is set, never values.
- The tunnel is up: `curl -s https://$TWILIO_VOICE_PUBLIC_DOMAIN/healthz` (only once the app is running).

## Steps

| # | Command | Creates | Write to `.env` |
|---|---|---|---|
| 1 | `npm run setup:memory-store` | Memory Store `OwlAir-<ts>` | `TWILIO_MEMORY_STORE_ID` |
| 2 | `npm run setup:conversation-config -- <storeId>` | Orchestrator Configuration `OwlAir-<ts>`: `GROUP_BY_PROFILE`, SMS/WhatsApp/RCS capture rules on `TWILIO_PHONE_NUMBER`, VOICE with **no** capture rules, memory extraction on | `TWILIO_CONVERSATION_CONFIGURATION_ID` |
| 2b | **statusCallbacks** (see below) | Points Orchestrator events at `https://<tunnel>/webhook` | none |
| 3 | `npm run profile:trait-groups` | `Loyalty`, `Travel` trait groups (`Contact` is system-managed) | none |
| 4 | `npm run profile:create` | Avery Stone profile (phone = `DEMO_PASSENGER_PHONE_NUMBER` or `DEMO_CALLER_PHONE_NUMBER`) | `TWILIO_MEMORY_PROFILE_ID` |
| 5 | `npm run profile:observations` | 3 observations (seat preference, upcoming trip, Gold rebooking) | none |
| 6 | wait ~30s, then `npm run profile:verify` | Nothing. Runs Recall and retries 5 times | none |
| 7 | `npm start` (restart if running) | none | none |

Then the presenter wires the number's **Voice** webhook to `https://<tunnel>/twiml` (POST) and leaves
**Messaging blank** (RUNBOOK_SETUP.md §6).

Talking points: Grouping-by-profile is what folds Voice and SMS for Avery into one conversation, and
it can't be changed after creation. Voice has no capture rules because TAC's TwiML ingests it
actively, and adding passive rules would double-bill STT. TAC fetches this Configuration at startup
and gets the Memory Store from it, so the app never reads `TWILIO_MEMORY_STORE_ID`.

### Step 2b: statusCallbacks (gap in the JS helper)

`2_create_conversation_config.js` does **not** set `statusCallbacks`, and without it inbound SMS never
reaches the app. Options, in order of preference:
- **Console:** Conversation Orchestrator → Conversation configurations → the config → Details → Edit →
  Webhook: Callback URL `https://<tunnel>/webhook`, method POST. This shows well on stage.
- **API:** GET `https://conversations.twilio.com/v2/ControlPlane/Configurations/<id>`, then PUT it back
  with `statusCallbacks: [{ url: 'https://<tunnel>/webhook', method: 'POST' }]`. Use the
  same pick-and-PUT pattern as `helpers/setup/4_update_conversation_config.js`, which keeps
  `channelSettings` and so on. The URL must be public HTTPS.
- If the tunnel URL changes, this must be updated along with the number's Voice webhook.

Don't edit the helper script on stage unless the user asks. Offer to add statusCallbacks to step 2 afterwards.

## Out of scope (from the original bash helpers in `.claude/plans/helpers/`)

These belong to the Python version and are **excluded by AGENTS.md**. Mention them only if the user asks:
- Intelligence (`npm run setup` steps 3-4; the bash version also creates custom operators
  `Intent-Recognition` and `Offer-Coupon` and posts to `/ci-webhook`, which this app doesn't serve).
- Studio handoff flow (bash `5_create_studio_handoff_flow.sh`, needs `DEMO_SPECIALIST_PHONE_NUMBER`).
- Avoid `npm run setup` because it runs the Intelligence steps and fails without operator IDs.

## Close a conversation

Use this to start the next demo segment fresh without waiting for `statusTimeouts` (inactive 10 min, closed 60).
Ask the user to confirm the conversation id first (from the dashboard or `GET /api/conversations`):

```bash
node --input-type=module -e "import { loadEnv, twilioRequest } from './helpers/common.js'; loadEnv(); console.log(await twilioRequest('PATCH', 'https://conversations.twilio.com/v2/Conversations/' + process.argv[1], { status: 'CLOSED' }))" <conversationId>
```

This is a JS version of `.claude/plans/helpers/close_conversation.py`.

## Reset and teardown

- Between demos: `npm run profile:cleanup` (dry run) → confirm → `npm run profile:cleanup:apply` →
  rerun steps 4-6 → restart the app (clears in-memory history and the dashboard). Keep the Store and Config.
- Full teardown: `npm run setup:cleanup` (dry run) → confirm → `npm run setup:cleanup:apply`.
  Single resource: `node helpers/setup/0_cleanup.js memory|conversation <id>`.

## Reading helper output

- `twilioRequest` (helpers/common.js) **throws on any non-2xx**. The Twilio SDK's `client.request()`
  doesn't throw by itself, and before this was fixed, errors looked like empty listings ("0 stores")
  or blank create responses. A count of 0 is now trustworthy.
- Control-plane DELETEs are **asynchronous**: they return 202 even for IDs that don't exist, and the
  real result (`COMPLETED` / `FAILED` + code) is in the `statusUrl` operation. Cleanup treats 404 as
  already deleted, so it's safe to run again.

## Constraints

- Configuration `displayName` `^[a-zA-Z0-9-_]+$`, max 32 chars. Max 10 Configurations, 15 Stores per account.
- The profile phone must be E.164 and match the caller ID Avery dials from, or Memory won't attach.
- Testing SMS from dev-phone in the same account produces duplicate Communications. Use a real phone.
