# RUNBOOK

Presenter script for the "Multi-channel AI on Twilio" demo. Follow the sections
in order during a live talk. Each step has an intent (SAY), an action (DO), and
what the audience should see (SHOW). Rough total demo runtime: 20-25 minutes.

The narrative arc:

1. **Baseline** - agent responds on Voice and SMS. It answers questions but has
   no persistent memory of the caller.
2. **Orchestrator** - show how Conversation Orchestrator aggregates the same
   caller across channels into one conversation thread.
3. **Memory** - seed a caller profile so the agent recalls facts across
   sessions.
4. **Finale** - cross-channel demo. Call, then switch to SMS. The agent
   remembers.

Because TAC boots against a Memory Store + Orchestrator Configuration, the
infrastructure is provisioned up front. What the demo layers is the *data* and
the *effect*, not the plumbing. Call this out to the audience so the narrative
reads honestly.

> **Setup is part of the story.** The provisioning walkthrough — Memory Store,
> Trait Groups, Configuration, capture rules — lives in
> [RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md) as a Console-driven guide. Present it
> before Section 1 if the audience wants to see the platform surface itself;
> skip it and reference the doc if you're time-boxed and only need to
> demonstrate behavior.

---

## Prerequisites

- Node.js 24+ and npm
- Twilio CLI installed and logged in: `twilio login`
- Twilio CLI dev-phone plugin: `twilio plugins:install @twilio-labs/plugin-dev-phone`
- ngrok (or another HTTPS tunnel): `npm install -g ngrok`, then `ngrok config add-authtoken <TOKEN>`
- **Agent number** — one Twilio number on this account (Voice + SMS capable); this is the number the demo caller dials
- A **separate caller number** for driving the demo — a real cell phone,
  OR a `twilio dev-phone` running from a **different** Twilio account. See
  the warning below.

> **⚠️ Do NOT drive the demo from a `dev-phone` number that lives on the
> same Twilio account as the agent number.** When both endpoints are
> Twilio numbers on the same account, Twilio writes two Message resources
> per SMS (outbound on the sender side, inbound on the receiver side, same
> from/to). Conversation Orchestrator's capture rule matches on
> `to: <agent>` and ingests **both**, so every customer SMS produces two
> Communications, two `COMMUNICATION_CREATED` events, and two AI replies.
> This is an intra-account testing artifact — not a code bug. Test SMS
> from a real cell phone or a cross-account dev-phone.
- OpenAI API key
- This repo checked out, `.env` filled in (see Section 0)

---

## Section 0 - One-time environment setup

For the full Console-driven walkthrough (Memory Store, Trait Groups,
Orchestrator Configuration, capture rules, phone-number webhooks), follow
[RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md) end-to-end. The steps below are the
short-form recap for a returning presenter who has already run setup once and
just needs to re-hydrate their local environment.

### 0.1 Install

```bash
git clone https://github.com/kaustavdm/twilio-multichannel-ai.git
cd twilio-multichannel-ai
npm install
cp .env.example .env
```

Fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`,
`TWILIO_API_SECRET`, `TWILIO_PHONE_NUMBER` (the agent number),
`DEMO_CALLER_PHONE_NUMBER` (dev-phone spare number), `OPENAI_API_KEY`.

Leave `TWILIO_MEMORY_STORE_ID`, `TWILIO_CONVERSATION_CONFIGURATION_ID`, and
`TWILIO_MEMORY_PROFILE_ID` blank for now - the helpers fill them in.

### 0.2 Provision Memory Store + Orchestrator Configuration

**Preferred (Console, live-demoable):** follow [RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md)
Sections 2-4. Copy the resulting `mem_store_…` and `conv_configuration_…`
values into `.env` as `TWILIO_MEMORY_STORE_ID` and
`TWILIO_CONVERSATION_CONFIGURATION_ID`.

**CLI shortcut (headless):**

```bash
npm run setup
```

This writes `TWILIO_MEMORY_STORE_ID`, `TWILIO_CONVERSATION_CONFIGURATION_ID`, and
`TWILIO_MEMORY_PROFILE_ID` into `.env` (only where missing or a placeholder), also seeds the
Memory profile, and sets the phone number's Voice URL if `TWILIO_VOICE_PUBLIC_DOMAIN` is set.
To demo Section 3 step by step instead, use `npm run setup:memory-store` and
`npm run setup:conversation-config`.

### 0.3 Start the tunnel

In a dedicated terminal:

```bash
ngrok http 8000
```

Copy the `https://<ngrok-domain>` URL. Set it in `.env`:

```bash
TWILIO_VOICE_PUBLIC_DOMAIN=<ngrok-domain>
```

(No `https://` prefix - TAC prepends it.)

### 0.4 Start the app

In another terminal:

```bash
npm run dev
```

You should see Fastify listen on `0.0.0.0:8000` and TAC log both channels
registered. Open `http://localhost:8000/` - the dashboard loads with "No
conversations yet."

Keep this terminal visible on stage; the logs are part of the story.

---

## Section 1 - Baseline agent

Goal: audience sees the agent respond on Voice and SMS. No memory. Time: ~7 min.

### 1.1 Wire the agent number's Voice webhook (Twilio Console)

**DO** open the [Twilio Console](https://console.twilio.com/).

Navigate to **Phone Numbers → Manage → Active numbers** (some console builds
show this as **Numbers & senders** — same page). Click the agent number.

Under **Voice Configuration**:

- **A call comes in** → **Webhook**
- URL: `https://<ngrok-domain>/twiml`
- HTTP: `POST`

Under **Messaging Configuration**: **leave every field blank**. Do **not**
set "A message comes in" to `/webhook` on your app — that pushes raw
Twilio SMS payloads, which TAC's `SMSChannel` rejects. Inbound SMS reaches
your app via Conversation Orchestrator's `statusCallbacks` webhook (set on
the CO Configuration in `RUNBOOK_SETUP.md` §4.2), not via the phone
number.

Save.

**SAY** *"Voice uses active ingestion — Twilio hits `/twiml`, we return
a `<ConversationRelay>` TwiML document with `conversationConfiguration`
embedded, and the call itself creates the conversation. SMS uses passive
ingestion — Orchestrator watches capture rules, creates the conversation
on its own, and POSTs `COMMUNICATION_CREATED` to `/webhook`. Same app,
two entry points, but only Voice is wired at the number level."*

### 1.2 Code showcase - TAC in three files

Keep this short: pull up each file, point at one line each.

**`src/server.js`** - TAC construction

```js
const tac = await TAC.create({ config: TACConfig.fromEnv() });
const voiceChannel = new VoiceChannel(tac, { memoryMode: 'once' });
const smsChannel = new SMSChannel(tac, { memoryMode: 'always' });
tac.registerChannel(voiceChannel);
tac.registerChannel(smsChannel);
tac.onMessageReady((event) => handleMessageReady(event, { tac }));
```

**SAY** *"TAC gives us one callback across every channel. Voice, SMS, RCS,
WhatsApp all funnel here."*

**`src/services/agent.js`** - the callback

```js
const systemPrompt = MemoryPromptBuilder.compose(SYSTEM_INSTRUCTIONS, memory, session);
// ... OpenAI chat.completions.create with tools ...
```

**SAY** *"`MemoryPromptBuilder` is TAC's adapter. It folds Conversation Memory -
profile traits and Recall observations - into the system prompt. Zero prompt
plumbing on our side."*

**`src/server.js`** - Fastify integration

```js
const server = new TACServer(tac, { voiceChannel, messagingChannels: [smsChannel],
                                     fastifyInstance: fastify, port: 8000 });
```

**SAY** *"We own the Fastify instance and hand it to TAC. Our dashboard routes
and TAC's webhook routes live on the same server."*

### 1.3 Start twilio dev-phone

> **Cross-account required for SMS.** Run `twilio dev-phone` under a
> Twilio profile whose account is **different** from the account hosting
> the agent number. Switch profiles with `twilio profiles:use <name>`
> (create one via `twilio profiles:add` if needed). Voice on the same
> account works fine; SMS on the same account doubles every message. See
> the Prerequisites warning.

In a third terminal:

```bash
twilio profiles:use <caller-account-profile>   # NOT the agent-number account
twilio dev-phone
```

The CLI opens `http://localhost:3001/` in the browser. On first run it
provisions a TwiML App and asks you to pick the dev-phone's Twilio number —
choose a number that lives on the **caller account** (not the agent number).

Alternative: skip dev-phone entirely and drive the demo from a real cell
phone. Voice and SMS both work; you lose the on-screen SMS log the
dev-phone UI provides.

### 1.4 Make the first call

In the dev-phone UI, dial the **agent number** (`TWILIO_PHONE_NUMBER`).

**SAY** *"Hi, I'd like to look up my Owl Airlines trip."*

**SHOW**:

- Voice reply from the agent (generic - it doesn't know who's calling)
- Dashboard sidebar populates with a new conversation, channel VOICE
- Live transcript shows caller + agent turns
- Tool events panel shows `check_trip_and_seats` fired with results from
  `assets/trip.json`

**SAY** *"The agent answered. Notice what it did **not** do: greet me by name.
The Memory Store is empty for this caller. Same LLM, no persistence yet."*

Hang up.

### 1.5 Send the first SMS

In the dev-phone UI, switch to the SMS panel. To: **agent number**. Body:
`"When does my flight leave?"`

**SHOW**:

- SMS reply arrives in dev-phone
- Dashboard: a **separate** conversation appears with channel SMS

**SAY** *"Two channels, two conversations. From Twilio's view, these are two
different callers today. That's the problem Conversation Orchestrator solves."*

---

## Section 2 - Conversation Orchestrator

Goal: show how Orchestrator aggregates channels. Time: ~5 min.

### 2.1 Tour the Configuration in Console

**DO** open the Console: **Products & services → Conversation Orchestrator →
Conversation configurations**.

Click the configuration created by `helpers/setup/2_create_conversation_config.js`
(default name pattern: `OwlAir-<YYYYMMDDHHmm>`; override with the
`CONVERSATION_CONFIG_NAME` env var). If you ran the Console-driven setup
instead, it'll be the `OwlAir-<YYYYMMDD>` you named in
[RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md) §4.2.

**SHOW** each field on the Overview tab:

- **Conversation grouping**: `GROUP_BY_PROFILE` - "same caller, one
  conversation, all channels"
- **Memory store**: linked to our store - "profile lookup by phone or email"
- **Conversation lifecycle and timeouts**: shows SMS timeouts; VOICE row is
  absent (Voice traffic was skipped in the wizard) or present with no
  capture rules
- **Channels / capture rules → SMS**: bidirectional rules for the agent
  number (wizard-generated)
- **Channels / capture rules → VOICE**: no rules

**SAY** *"Voice is captured via the active TwiML path (`<ConversationRelay>`
carries `conversationConfiguration`). If we also added passive VOICE capture
rules here, we'd be billed for STT twice. So VOICE has channel settings but no
capture rules - that's the intended pattern."*

### 2.2 Show captured conversations

**DO** from the Configuration detail page (still on §2.1), open the
**Conversations** tab. That view lists every conversation Orchestrator
captured against this Configuration. (Alternate path: `⌘K` → "Conversations"
and pick the one scoped to your Configuration ID.)

**SHOW** the two conversations from Section 1. Click into each and highlight:

- Communications list (transcripts + SMS body)
- Participant addresses
- The linked profile (auto-created but empty — click through to see the
  bare identifiers with no traits)

**SAY** *"Both interactions were captured. But since the profile is empty
- no traits, no observations - the Memory-Prompt-Builder had nothing to inject.
That's what we fix next."*

### 2.3 The app is already integrated

**DO** show `.env` (redact secrets):

```bash
TWILIO_CONVERSATION_CONFIGURATION_ID=conv_configuration_...
TWILIO_MEMORY_STORE_ID=mem_store_...
```

**SAY** *"TAC picks these up from the environment. There is no additional
integration code - the `TACConfig.fromEnv()` call in `server.js` reads these
and hands them to the Voice and SMS channels. Every message-ready callback
already receives a `memory` argument from Orchestrator's linked store."*

---

## Section 3 - Conversation Memory

Goal: seed a caller profile and show recall. Time: ~5 min.

### 3.1 Tour the Memory Store in Console

**DO** navigate to **Products & services → Conversation Memory → Memory
stores**.

Click the store created by `helpers/setup/1_create_memory_store.js` (default
name pattern: `OwlAir-<YYYYMMDDHHmm>`; overridable via `MEMORY_STORE_NAME`).

**SHOW**:

- **Traits** tab (in the store's Settings): three trait groups —
  `Contact` (default, ships with the store), and the two we care about for
  this demo, `Loyalty` and `Travel` (matching `TWILIO_MEMORY_PROFILE_TRAIT_GROUPS` in
  `.env`). `MemoryPromptBuilder` will only surface the groups listed in
  `TWILIO_MEMORY_PROFILE_TRAIT_GROUPS` into the prompt.
- **Identifiers** tab: default rules `phone`, `email`, `whatsappid`, `chat`
  — no per-trait toggles.
- **Profiles** tab: an auto-created row keyed to the dev-phone spare number
  (identity resolution from Section 1's calls). No traits populated.

**SAY** *"Orchestrator auto-created this profile the first time the caller
touched our system. It has an identifier (phone number) and nothing else yet."*

### 3.2 Seed Avery's profile

Back in the terminal:

```bash
export DEMO_CALLER_PHONE_NUMBER=+1<dev-phone number>
npm run profile
```

`npm run profile` runs four steps in order (see `helpers/profile/run_all.js`):
`1_create_trait_groups` → `2_create_profile` → `3_add_observations` →
`4_verify_memory`. It populates Avery's profile with:

- **Contact traits:** `firstName=Avery`, `lastName=Stone`,
  `phone=<DEMO_CALLER_PHONE_NUMBER>`, `email=avery.stone@example.com`
- **Loyalty traits:** `memberNumber=OWL-4821`, `tier=Gold`,
  `milesBalance=84200`
- **Travel traits:** `seatPreference=window seat near the front`,
  `mealPreference=vegetarian`, `accessibilityNeeds=none`
- **Three observations** written to
  `/v1/Stores/{storeId}/Profiles/{profileId}/Observations`:
  1. *"Avery prefers window seats near the front of the cabin and usually
     avoids middle seats."*
  2. *"Upcoming trip OA404 from London to San Francisco is scheduled for
     tomorrow at 7:00 PM. Avery wants to change from seat 18B to a window seat if one is
     available."*
  3. *"Avery is an Owl Club Gold member and appreciates proactive rebooking
     help during delays."*

(No conversation summary is written by this script — summaries are generated
by the platform on the CLOSED/INACTIVE transition of a real conversation, per
§4.5 of [RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md).)

`TWILIO_MEMORY_PROFILE_ID` is written into `.env` if it's missing or a placeholder.

> **If you already created `Loyalty` and `Travel` manually via
> [RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md) §3**, step 1 will error on the
> "trait group already exists" conflict. Skip it — run only:
>
> ```bash
> npm run profile:create && npm run profile:observations && npm run profile:verify
> ```
>
> Same result, no conflict.

> **The Contact `email` trait must exist first.** `2_create_profile` writes
> `Contact.email = avery.stone@example.com`. If you skipped
> [RUNBOOK_SETUP.md](./RUNBOOK_SETUP.md) §3.2 (adding `email` to the default
> Contact group), that trait write will fail. Either add `email` to Contact
> in the Console first, or drop the `email` line from
> `helpers/profile/2_create_profile.js`.

**DO** refresh the Console profile page. Show the traits + observations.

**SAY** *"Nothing about the app needs to change. `MemoryPromptBuilder` will
pull these into the system prompt on the next turn."*

### 3.3 Restart the app (optional)

If the app was already handling the earlier calls, restart it to clear the
in-memory conversation history so the audience sees a clean start:

```bash
# In the npm run dev terminal: Ctrl+C, then
npm run dev
```

---

## Section 4 - Multichannel with memory (finale)

Goal: cross-channel continuity. Time: ~5 min.

### 4.1 Call as Avery

From the dev-phone (same spare number), dial the **agent number**.

**SAY** *"Hi, I'd like to change my seat."*

**SHOW**:

- Voice reply now uses Avery's name and references the OA404 London→SFO trip
- Dashboard: new VOICE conversation, but note the sidebar - the earlier SMS
  conversation may **merge** into the same thread because
  `GROUP_BY_PROFILE` links them
- Tool events show `check_trip_and_seats` firing with the seat preference from
  Memory

**SAY** *"Same code, same LLM, same tools. What changed is the persistent
context. Memory Recall pulled the observation `Prefers window seats near the
front` into the prompt, so the agent led with a window option without me
telling it."*

### 4.2 Continue on SMS

Hang up. In dev-phone SMS panel, send to the agent number:

`"Can you text me the seat details?"`

**SHOW**:

- SMS reply lands in dev-phone with the seat details from the previous call
- Dashboard shows the SMS turn appended to the **same** conversation thread as
  the voice call (thanks to `GROUP_BY_PROFILE`)
- Optionally the agent invokes the `send_text_message` tool to send a follow-up
  from the agent number

**SAY** *"One caller, two channels, one conversation. Memory carried across
without a database in our app. This is the point: your agent shouldn't live in
one chatbox."*

---

## Reset between demos

To replay cleanly:

```bash
# Clear seeded profile data
npm run profile:cleanup:apply

# Restart the app to clear in-memory history
# (Ctrl+C in the npm run dev terminal, then npm run dev)
```

Leave the Memory Store and Orchestrator Configuration in place - re-provisioning
those on stage burns time.

---

## Fallback plans

| If this breaks | Do this |
|----------------|---------|
| ngrok URL churns mid-demo | Use a paid ngrok reserved domain, or `cloudflared` with a named tunnel. Update the Console webhooks once. |
| dev-phone won't provision | Fall back to using your real mobile phone - dial the agent number directly. Watch out that the caller ID matches the seeded profile phone. |
| Twilio Console UI shifts | Product areas under **Products & services**: **Conversation Orchestrator** (Conversation configurations + captured conversations), **Conversation Memory** (Memory stores, Traits, Identifiers), **Phone Numbers** (Active numbers). Use the search bar (⌘K) with the product name if paths move. |
| Voice call goes to voicemail | Confirm `TWILIO_VOICE_PUBLIC_DOMAIN` is the current ngrok host and that the Voice webhook URL was saved. Check `npm run dev` logs for an incoming `/twiml` POST. |
| Memory doesn't recall | Confirm `TWILIO_MEMORY_PROFILE_ID` matches the phone number you're calling from. Check the profile in Console - traits must be populated, not just identifiers. |

---

## Reference

- Twilio Console: `https://console.twilio.com/`
- TAC TypeScript SDK: `https://github.com/twilio/twilio-agent-connect-typescript`
- Conversation Orchestrator docs: `https://www.twilio.com/docs/conversations/orchestrator`
- Conversation Orchestrator quickstart: `https://www.twilio.com/docs/conversations/orchestrator/quickstart`
- Conversation Memory docs: `https://www.twilio.com/docs/conversations/memory`
- Conversation Memory — Getting started: `https://www.twilio.com/docs/conversations/memory/getting-started`
- Dev-phone: `https://www.twilio.com/docs/labs/dev-phone`
