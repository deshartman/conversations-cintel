# RUNBOOK — Setup (Twilio Console walkthrough)

Step-by-step provisioning guide for **Conversation Memory** and **Conversation
Orchestrator**, done entirely through the current Twilio Console (no CLI, no
shell scripts). Follow this before running the demo in
[RUNBOOK.md](./RUNBOOK.md).

Total time on stage or off: **~15 minutes.** Everything provisioned here is safe
to leave in place between demos — only the seeded profile in Section 5 needs a
reset.

> **Why show setup on stage?** Because the audience needs to see that
> Orchestrator and Memory are *products* with their own UI, lifecycle, and
> configuration surface — not just SDK glue. The runbook mirrors what a
> customer platform team would do in production.

> **A note on Console navigation.** All Console paths below start from
> **Products & services** (top-level nav in the current Twilio Console).
> When in doubt, use `⌘K` / `Ctrl+K` and search for the product name —
> "Conversation Memory", "Conversation Orchestrator", "Active numbers".

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Create the Memory Store](#2-create-the-memory-store)
3. [Add Trait Groups and Traits](#3-add-trait-groups-and-traits)
4. [Create the Conversation Orchestrator Configuration](#4-create-the-conversation-orchestrator-configuration)
5. [(Optional) Seed a demo passenger profile](#5-optional-seed-a-demo-passenger-profile)
6. [Wire the phone number's Voice webhook](#6-wire-the-phone-numbers-voice-webhook)
7. [Populate `.env` and verify](#7-populate-env-and-verify)
8. [Teardown / reset](#8-teardown--reset)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Before you open the Console:

- **Twilio account** with a credit card on file. Free trial accounts cannot
  provision Memory Stores or Conversation Configurations.
- **Agent number** — one E.164 number on **this** account, Voice + SMS
  capable. This is the number the demo caller dials.
- **A separate caller number for testing** — a real cell phone, OR a
  `twilio dev-phone` running from a **different** Twilio account than the
  one hosting the agent number.
  > **⚠️ Do NOT test with a `dev-phone` number that lives on the same
  > Twilio account as the agent number.** When both sender and receiver are
  > Twilio numbers on the same account, Twilio records **two** Message
  > resources for every SMS (an `outbound-api` on the sender side and an
  > `inbound` on the receiver side, same from/to). Conversation
  > Orchestrator's capture rule matches on `to: <agent>` and ingests
  > **both**, so every customer SMS becomes two Communications, fires
  > `COMMUNICATION_CREATED` twice, and the agent replies twice. This is a
  > testing artifact of intra-account traffic, not a code bug — cross-
  > account or off-Twilio traffic behaves correctly.
- **Public tunnel** (ngrok, cloudflared, or similar) so Twilio's webhooks can
  reach your local Fastify server on port `8000`. Have the tunnel URL ready
  **before Section 4** — the Configuration wizard's Webhook field needs it.
- **Console access as an owner or administrator.** Memory and Orchestrator
  create/delete actions require account-scope permissions; sub-account users
  see the resources but cannot create them.
- **AI features addendum acceptance.** The Voice transcription step in
  Section 4 requires accepting Twilio's *Predictive and Generative AI/ML
  Features Addendum* the first time you use these products on an account.

Open the Console at **`https://console.twilio.com/`** and confirm you're in
the correct account (top-left account switcher). Every screen path below
assumes that account context.

---

## 2. Create the Memory Store

Memory Store is where every caller's traits, observations, and summaries live.
Orchestrator refers to it by ID, so the store must exist first.

> **You can create it inline from Section 4's wizard.** The Configuration
> wizard's "Enable Conversation Memory" step has a **Create new memory store**
> button. If you'd rather do everything in one flow, skip this section and use
> that button in Section 4.8. Otherwise, create the store here so you have the
> ID ready.

### 2.1 Navigate

Console → **Products & services** → **Conversation Memory** → **Overview**.

### 2.2 First-run: upgrade if prompted

If the Overview page shows an **Upgrade your account for full access** banner,
click it and then **Upgrade account**. This is a no-cost gate — it flips the
account onto the Conversation Memory service plan. Skip this if you don't see
the banner.

### 2.3 Provision the store

Click **Get started**.

Twilio auto-creates and auto-names a Memory Store for the account. There's no
form to fill in at creation time.

### 2.4 Rename the store (recommended)

Once the store lands, rename it so multiple demos are distinguishable:

**Settings → Edit settings** → set:

| Field | Value | Notes |
|-------|-------|-------|
| **Memory store name** | `OwlAir-<YYYYMMDD>` | Pattern is `^[a-zA-Z0-9-]+$` — no spaces, no underscores. |
| **Description** | `Memory store for Owl Airlines customers` | Free text, optional. |

Click **Save**.

### 2.5 Capture the store ID

Still on the store's detail page, copy the identifier that starts with
`mem_store_…` (visible in the header or in **Settings**). You will paste it
into `.env` in Section 7 as `TWILIO_MEMORY_STORE_ID`.

**SAY (if presenting):** *"That's the Memory Store — a durable, per-tenant
container for every customer profile the AI will see. It's provisioned once
and shared across every channel."*

---

## 3. Add Trait Groups and Traits

Traits are structured facts (member tier, seat preference). They live inside
**Trait Groups**, which are managed on a single **Traits** tab under Memory
Settings.

### 3.1 Navigate

Console → **Products & services** → **Conversation Memory** → **Memory stores** → Select Memory Store -> **Traits**.

### 3.2 The default `Contact` group

Every Memory Store ships with a **Contact** group already populated with
seven fields (Twilio's docs describe this as "first name, last name, phone
number, and address" — in the actual UI, `address` is broken into four
sub-fields):

- `firstName` (string)
- `lastName` (string)
- `phoneNumber` (string)
- `street` (string)
- `city` (string)
- `state` (string)
- `postalCode` (string)

Do **not** delete or recreate any of these. If you need extra Contact
fields for the demo (e.g. `email`), click **+ Add trait** under the
Contact group's header and fill in name / data type / description.

Click **Save**.

### 3.3 Create the `Loyalty` group

Click **+ Add trait group** at the top of the Traits page.

| Field | Value |
|-------|-------|
| **Trait group name** | `Loyalty` |
| **Description** | `Owl Club loyalty program facts` |

Save.

Then inside the new `Loyalty` header, click **+ Add trait** three times:

| Trait name | Data type | Description |
|------------|-----------|-------------|
| `memberNumber` | string | Owl Club member number |
| `tier` | string | Owl Club loyalty tier (Bronze / Silver / Gold) |
| `milesBalance` | number | Current loyalty miles balance |

### 3.4 Create the `Travel` group

Click **+ Add trait group** again.

| Field | Value |
|-------|-------|
| **Trait group name** | `Travel` |
| **Description** | `Passenger travel preferences` |

Save. Then add these traits:

| Trait name | Data type | Description |
|------------|-----------|-------------|
| `seatPreference` | string | Preferred seat type (window/aisle/etc.) |
| `mealPreference` | string | Preferred in-flight meal |
| `accessibilityNeeds` | string | Accessibility or assistance needs |

### 3.5 Verify identifier rules (do NOT add per-trait promotion)

Identifiers are **not** a per-trait toggle in the current Console. Switch to
the **Identifiers** tab (same Settings page as Traits).

Every new Memory Store starts with these default Identity Resolution rules
enabled:

- `phone`
- `email`
- `whatsappid`
- `chat`

For this demo, the defaults are enough — `phone` is what lets Orchestrator
find Avery's profile when the dev-phone number calls in. No action needed.

If a rule is missing (rare, only if a prior demo deleted it), click **Add
identity rule** → give it a name (e.g. `phone`), map it to a stored trait or
use the API path, rank priority, and save.

> **Common mistake.** Older docs (and older revs of this runbook) describe an
> "ID type promotion" toggle on individual traits. The current 1Console does
> **not** have that. Identifier rules are configured on the **Identifiers**
> tab, entirely separate from trait definitions.

### 3.6 Verify

The **Traits** tab should now list three trait groups: **Contact**,
**Loyalty**, **Travel**. Each should show its traits with data types.

---

## 4. Create the Conversation Orchestrator Configuration

The Configuration is the routing brain. In the Console it's built through a
**7-step wizard**.

### 4.1 Navigate

Console → **Products & services** → **Conversation Orchestrator** →
**Conversation configurations**.

Click **Create a Conversation configuration**.

### 4.2 Step 1 — Name configuration

| Field | Value |
|-------|-------|
| **Conversation configuration name** | `OwlAir-<YYYYMMDD>` |
| **Description** | `Owl Airlines omnichannel Conversation Orchestrator configuration` |
| **Conversation grouping** | **Group by profile** ✅ |
| **Webhook** | `https://<ngrok-domain>/webhook` |
| **HTTP method** | **POST** |

> **This Webhook is where TAC receives SMS events.** The wizard labels it
> "optional" but this demo **requires** it. The URL maps to the
> Configuration's `statusCallbacks[0]` field — Conversation Orchestrator
> POSTs `COMMUNICATION_CREATED`, `CONVERSATION_UPDATED`, etc. to it. TAC's
> `SMSChannel` listens at `/webhook` and reads those events. **Do not** put
> this URL on the phone number's "A message comes in" field in Section 6
> — that would push raw Twilio SMS payloads, which TAC rejects with
> `Invalid webhook payload`.

> **⚠️ Grouping is immutable.** After you click **Create Conversation
> configuration** at the end of the wizard, `conversationGroupingType` becomes
> read-only. The only way to change it is to create a new Configuration.
> **Group by profile** is what folds SMS + Voice + WhatsApp for the same
> caller into a single thread.

Click **Next**.

### 4.3 Step 2 — Messaging and chat traffic

You'll see checkboxes for **SMS/MMS**, **WhatsApp**, **RCS**, and (via
bridge) **Chat**. For each channel you want to capture passively, tick its
box and select your **agent number** in the phone-numbers dropdown.

For the base demo:

- **SMS/MMS phone numbers:** select your agent number.
- **WhatsApp / RCS / Chat:** leave unchecked (only add if you actually have
  those senders in this account).

> **Why not hand-author capture rules?** The wizard creates the bidirectional
> `from: <agent>, to: *` and `from: *, to: <agent>` rules for you when you
> pick a number. If you need to add narrower rules (metadata filters, CLIENT
> voice), edit the Configuration after creation via the API.

Click **Next**.

### 4.4 Step 3 — Voice traffic

**Click Skip this Step. Do not check "Set up automatic capture".**

> **⚠️ Voice double-billing warning.** This app uses `<ConversationRelay
> conversationConfiguration="…">` in the TwiML that TAC serves for inbound
> calls (see `src/server.js`). That's *active ingestion* — Relay already
> transcribes the call and pushes turns into the conversation. If you also
> enable "Set up automatic capture" here, Twilio will run Real-Time
> Transcription *again* over the same audio. You get charged for STT
> **twice** with no functional benefit. Skipping this step produces the
> correct `channelSettings.VOICE` shape: lifecycle timeouts only, zero
> capture rules.

### 4.5 Step 4 — Configure lifecycle

Two lifecycle options are available:

- **Basic** — Conversations move from **Open** → **Closed**. Observations
  extract only on the CLOSED transition.
- **Include "inactive" state** — Conversations move from **Open** →
  **Inactive** (idle but reopenable) → **Closed**. Observations extract on
  the INACTIVE transition *and* on CLOSED.

For the demo, choose **Include "inactive" state** so the memory loop fires
faster (after 10 min of silence rather than 60 min).

Only channels you enabled in earlier steps appear here — since Voice was
skipped in §4.4, only **SMS** shows on this page. Recommended timeouts:

| Channel | Inactive timeout | Closed timeout |
|---------|-----------------|----------------|
| SMS | 10 minutes | 60 minutes |

> **Voice channel note.** Voice doesn't appear on this page because you
> skipped it. Its timeouts are governed by the active-TwiML path — when the
> ConversationRelay transcription stream ends (on hangup), the voice
> channel closes automatically. See Twilio's lifecycle docs on
> `statusTimeouts: null` semantics.

Click **Next**.

### 4.6 Step 5 — Enable Conversation Memory

**Memory store:** select the store you created in Section 2 (dropdown lists
your `mem_store_…` IDs by display name).

If you skipped Section 2, click **Create new memory store**, enter a name
like `OwlAir-<YYYYMMDD>`, click **Save**, then select it from the dropdown.

**Observations and summaries:** ✅ Check **Turn on observations and
summaries**.

> **Why turn on observations and summaries?** This is what fires memory
> extraction when a conversation transitions to `INACTIVE` or `CLOSED` —
> observations get written back to the linked Memory Store, and a summary is
> generated per conversation. Without this checkbox, the conversation still
> captures, but nothing is ever committed to profile memory.

Click **Next**.

### 4.7 Step 6 — Voice transcription

Review the transcription summary panel.

If this is your first time using AI features on this account, tick the
**Predictive and Generative AI/ML Features Addendum** checkbox to agree to
the terms.

Click **Next**.

### 4.8 Step 7 — Summary

Review your settings. Confirm:

- **Grouping type:** Group by profile ✅
- **SMS capture:** agent number ✅
- **Voice capture:** none (skipped) ✅
- **Memory store:** linked to your `OwlAir-…` store ✅
- **Observations & summaries:** on ✅

Click **Create Conversation configuration**.

### 4.9 Capture the Configuration ID

The wizard's completion screen shows the new configuration in the list. Click
into it and copy the identifier that starts with `conv_configuration_…`. You
will paste it into `.env` in Section 7 as
`TWILIO_CONVERSATION_CONFIGURATION_ID`.

**SAY (if presenting):** *"That single Configuration is now the routing
brain for every channel we capture. Notice VOICE has no capture rules —
active ingestion via ConversationRelay handles that. SMS has bidirectional
rules scoped to our agent number, generated for us by the wizard. And every
inactive or closed conversation will write observations back to the Memory
Store we linked. Zero code — one guided flow."*

### 4.10 (Optional) Adding Intelligence later

Intelligence is a **separate** Configuration you create alongside this
Conversation Configuration.

- **In the Console:** Products & services → **Conversation Intelligence** →
  **Intelligence configurations** → **Create intelligence configuration** →
  set **Name** and (optionally) **Description** → under **Attach
  Conversation Configuration**, select the Conversation Configuration you
  just built in §4 → **Submit**. That attachment tells Intelligence which
  conversations to analyze, and — behind the scenes — writes this
  Intelligence Configuration's ID into the Conversation Configuration's
  `intelligenceConfigurationIds` list.
- **Via API:** POST to `intelligence.twilio.com/v3/ControlPlane/Configurations`
  to create the Intelligence config, then PUT the Conversation config back
  with `intelligenceConfigurationIds: ["intelligence_configuration_…"]`.
  Conversation Configurations use `PUT` for updates (full replacement, no
  partials) — always GET first, modify, then PUT the whole object back.

---

## 5. (Optional) Seed a demo passenger profile

For the Section 3 → Section 4 demo arc in [RUNBOOK.md](./RUNBOOK.md), you
need one profile pre-loaded with traits and observations so the AI can
"remember" Avery Stone.

The Console's primary path for adding profile data is **CSV upload**. For
individual profile creation with observations, use the API helper script
(`npm run profile`) — it's faster and idempotent.

### Option A — Console CSV upload (recommended for one-off seeding)

**Step 1.** Create a CSV file locally, e.g. `avery.csv`:

```csv
phone,firstName,lastName,email,memberNumber,tier,milesBalance,seatPreference,mealPreference,accessibilityNeeds
<your dev-phone number in E.164>,Avery,Stone,avery.stone@example.com,OWL-4821,Gold,84200,window seat near the front,vegetarian,none
```

**Step 2.** In the Console, go to **Products & services** →
**Conversation Memory** → **[your Memory Store]** → **+ Add profiles**.

**Step 3.** On the **Select a CSV** page, upload `avery.csv` → **Next**.

**Step 4.** On the **Map CSV columns** page, map each column to the
matching trait:

| CSV column | Trait group | Trait |
|------------|-------------|-------|
| `phone` | Contact | `phoneNumber` (matches the built-in `phone` identifier) |
| `firstName` | Contact | `firstName` |
| `lastName` | Contact | `lastName` |
| `email` | Contact | `email` (the trait you added in §3.2) |
| `memberNumber` | Loyalty | `memberNumber` |
| `tier` | Loyalty | `tier` |
| `milesBalance` | Loyalty | `milesBalance` |
| `seatPreference` | Travel | `seatPreference` |
| `mealPreference` | Travel | `mealPreference` |
| `accessibilityNeeds` | Travel | `accessibilityNeeds` |

> **CSV column-name flexibility.** The CSV column headers don't have to
> match the trait names exactly — the Map CSV columns page lets you point
> any column at any trait. The names above just make the mapping obvious.

Click **Complete**.

**Step 5.** Two things to check after upload:

- **Data sources → CSV Upload** (inside your Memory Store) — the uploaded
  file should flip to **Status: Completed** within a minute or two.
  `Completed` means Twilio ingested every row (or, per Twilio's docs,
  fewer than 100 rows failed — check the file detail view to be sure).
- **Profiles** tab — Avery's new profile should appear as a row keyed by
  the identifiers you supplied. Click it to see the traits laid out by
  Contact / Loyalty / Travel groups.

### Option B — Observations require the API helper

The Console's CSV path handles **traits and identifiers**, but does not
support observations. Observations are the free-text, semantically-searchable
snippets that Recall folds into the LLM prompt. Add them via
`helpers/profile/3_add_observations.js` (part of `npm run profile`):

```bash
npm run profile
```

This script:

1. Looks up Avery's profile by `phone`.
2. POSTs three observations to
   `/v1/Stores/{storeId}/Profiles/{profileId}/Observations`:
   - Seat preference detail
   - Upcoming trip OA404 (London → SFO)
   - Owl Club Gold + rebooking expectations

If you'd rather seed traits *and* observations in one shot, skip Option A
and just run `npm run profile` — it does both.

### 5.1 Capture the profile ID

From the profile header, copy the value that starts with `mem_profile_…`.
Store as `TWILIO_MEMORY_PROFILE_ID` in `.env` for reference only — the app
resolves profiles by identifier (`phone`), not by ID.

### 5.2 Confirm indexing

Semantic search is asynchronous. Give the store ~30 seconds after the last
observation write before running the demo — otherwise Recall may miss the
newest observation.

Recall is an **API-only** capability today (no Console query UI). To verify,
either:

- Run `npm run profile 4` (invokes `helpers/profile/4_verify_memory.js`,
  which POSTs to `/v1/Stores/{storeId}/Profiles/{profileId}/Recall` and
  prints the ranked observations), or
- Trigger the demo call/SMS end-to-end and watch the dashboard's Memory
  panel populate.

Alternatively, open the profile in the Console → **Observations** tab and
confirm all three seeded rows show up. That confirms *storage*; it doesn't
confirm the semantic index has caught up.

> **Batch limits (if you're scripting).** The Observations API caps batches
> at 10 per request and 4096 chars per observation.

---

## 6. Wire the phone number's Voice webhook

Point the agent number's Voice webhook at your local Fastify server so TAC
serves the ConversationRelay TwiML. SMS is not wired at the number — see
§6.4 for why, and §4.2 for the CO `statusCallbacks` webhook that
actually delivers SMS events to your app.

### 6.1 Start the tunnel and app first

In terminal windows (on your dev machine, not the Console):

```bash
# Terminal 1
ngrok http 8000

# Terminal 2 (only after .env is populated in Section 7)
npm run dev
```

Copy the `https://<subdomain>.ngrok-free.app` URL — you'll need it below.

### 6.2 Navigate

Console → **Phone Numbers** → **Manage** → **Active numbers**. (Some
console builds surface this as **Numbers & senders** in the top-level
nav — same page, different label. Use `⌘K` and search "Active numbers" if
in doubt.)

Click the **agent number**.

### 6.3 Voice Configuration

Scroll to **Voice Configuration**.

| Field | Value |
|-------|-------|
| **Configure with** | **Webhook, TwiML Bin, Function, Studio Flow, Proxy Service** |
| **A call comes in** | **Webhook** |
| **URL** | `https://<subdomain>.ngrok-free.app/twiml` |
| **HTTP** | `POST` |

Leave **Primary handler fails** (fallback URL) empty for the demo.

### 6.4 Messaging Configuration

Scroll to **Messaging Configuration**.

**Leave every field in this section blank / at its default.** Do **not**
set "A message comes in" to your ngrok URL — that pushes raw Twilio SMS
payloads to `/webhook`, which TAC's `SMSChannel` rejects with
`Invalid webhook payload`.

Inbound SMS is captured passively by Conversation Orchestrator using the
SMS capture rule the wizard created in §4.3, and events flow to your app
via the Configuration's `statusCallbacks` webhook you set in §4.2. The
phone number never sends SMS to your app directly.

If the number was previously wired to your app (older revision of this
runbook), clear these fields explicitly:

| Field | Value |
|-------|-------|
| **A message comes in** | leave blank |
| **URL** | leave blank |
| **Primary handler fails** | leave blank |

If the number is attached to a **Messaging Service**, open the Service
(Console → **Messaging → Services**) and confirm **Integration → Inbound
Request URL** is empty, or that the Service is set to **Defer to sender's
webhook** (`useInboundWebhookOnNumber: true`). Either way, no SMS webhook
should point at your app.

### 6.5 Save

Click **Save configuration** at the bottom of the page.

> **Why voice is wired to the number but SMS is not.** Voice uses **active
> ingestion**: `/twiml` returns a `<ConversationRelay>` document with
> `conversationConfiguration` embedded, and Orchestrator creates the
> conversation from inside the call itself. So the number's Voice webhook
> must point at your app — that's where the TwiML is served.
> SMS uses **passive ingestion**: Orchestrator watches capture rules and
> creates the conversation on its own, then POSTs
> `COMMUNICATION_CREATED` to the Configuration's `statusCallbacks` URL —
> the `/webhook` you set in §4.2. If you ALSO wire the number's SMS
> webhook to `/webhook`, TAC receives raw Twilio SMS payloads (from the
> number webhook) *and* proper CO events (from `statusCallbacks`); the raw
> payloads fail validation and the CO events work, so you'll see both
> success and error rows for every SMS. Keeping the number's SMS webhook
> blank is the correct configuration.

---

## 7. Populate `.env` and verify

Back in the repo:

```bash
cp .env.example .env
```

Fill in the IDs and secrets you gathered:

| `.env` key | Where it came from |
|------------|-------------------|
| `TWILIO_ACCOUNT_SID` | Console → account switcher → **Account SID** |
| `TWILIO_AUTH_TOKEN` | Console → account switcher → **Auth Token** (reveal) |
| `TWILIO_API_KEY` / `TWILIO_API_SECRET` | Console → **Settings** → **Account settings** → **API keys & tokens** → **Create API key** (Standard key is fine; copy the secret immediately — it's only shown once) |
| `TWILIO_PHONE_NUMBER` | Agent number from Section 6 (E.164) |
| `TWILIO_MEMORY_STORE_ID` | Section 2.5 (`mem_store_…`) |
| `TWILIO_CONVERSATION_CONFIGURATION_ID` | Section 4.9 (`conv_configuration_…`) |
| `TWILIO_MEMORY_PROFILE_ID` | Section 5.1 (`mem_profile_…`) — optional, reference only |
| `TWILIO_TRAIT_GROUPS` | `Loyalty,Travel` (comma-separated; matches Section 3, minus the default Contact group) |
| `TWILIO_VOICE_PUBLIC_DOMAIN` | ngrok host from Section 6.1, **no `https://` prefix** |
| `DEMO_CALLER_PHONE_NUMBER` | Dev-phone spare number (E.164) — the number the caller dials *from* |
| `OPENAI_API_KEY` | Your OpenAI dashboard |

### 7.1 Verify

```bash
npm run dev
```

Expected boot log (abbreviated):

```
[TAC] Voice channel registered
[TAC] SMS channel registered
[Fastify] listening on 0.0.0.0:8000
[Dashboard] http://localhost:8000/
```

Open `http://localhost:8000/` — the dashboard should render with **No
conversations yet**.

Then send a test SMS to the agent number **from a real cell phone, or from
a dev-phone that lives on a different Twilio account**. See the §1
warning — a dev-phone on the *same* account produces two Communications
per SMS and doubles the reply, and that is not a bug you need to fix.

```
"Test"
```

You should see, in order:

1. `npm run dev` logs a `POST /webhook` from Twilio (this is the
   Conversation Orchestrator `statusCallbacks` webhook you set in §4.2,
   *not* a phone-number-level SMS webhook).
2. Dashboard sidebar shows a new SMS conversation.
3. Console → **Products & services → Conversation Orchestrator →
   Conversation configurations → [your config] → Conversations** tab
   shows the same conversation captured by Orchestrator.
4. Console → **Products & services → Conversation Memory → [store] →
   Profiles** shows a profile matching the dev-phone number (identity-
   resolved from Avery's `phone` value if seeded, otherwise auto-created
   empty).

All four = setup is correct. Proceed to [RUNBOOK.md](./RUNBOOK.md) Section 1
for the demo flow.

---

## 8. Teardown / reset

**Between demos:**

- To clear seeded profile data only, keep the Store + Configuration:
  - Console → **Conversation Memory → [store] → Profiles** → open Avery's
    profile → **Delete profile**. This cascades to observations and
    summaries.
  - Or run `node helpers/profile/0_cleanup.js` from the CLI.
- Restart `npm run dev` to clear in-memory conversation history.

**Full teardown (end of demo cycle):**

Order matters — the Conversation Configuration references the Memory Store
(via `memoryStoreId`), so the Configuration must go first.

1. Console → **Conversation Orchestrator → Conversation configurations** →
   open your config → look for the **Delete** action (top-right kebab / row
   ellipsis / detail-page button, depending on the current UI). Confirm.
2. Console → **Conversation Memory → [your Memory Store] → Settings** →
   look for the **Delete memory store** action. Confirm.
3. Console → **Phone Numbers → Manage → Active numbers** → agent number →
   clear the Voice webhook URL (the Messaging field should already be blank
   per §6.4). Save.

If the Console button is hidden or greyed out (e.g. Memory Store still
referenced by another Configuration), delete via API:
`DELETE https://conversations.twilio.com/v2/ControlPlane/Configurations/{id}`
then `DELETE https://memory.twilio.com/v1/ControlPlane/Stores/{id}`.

Deletions **cannot** be recovered — profiles, observations, stores, and
configurations are all irreversibly removed.

> **Intelligence side-effect.** If you attached an Intelligence
> Configuration (per §4.10), deleting the Conversation Configuration also
> removes its captured conversations and their operator results from
> Intelligence automatically (per Twilio's data-hygiene sync). You do not
> need to detach Intelligence first.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| **Get started** button missing on Conversation Memory Overview | Account not yet upgraded for full access | Click the **Upgrade your account for full access** banner first, then reload. |
| Trait group / trait create fails | Trait or group name has spaces/invalid chars, or wrong data type | Use a single-word alphanumeric name (Twilio doesn't document an explicit regex, but names with spaces or symbols reject in the UI). In the wizard the data type dropdown lists `string`, `number`, `boolean`, `array` — via the API these are uppercase `STRING`, `NUMBER`, `BOOLEAN`, `ARRAY`. |
| Configuration create rejects name | Name exceeds pattern | Configuration `displayName` must match `^[a-zA-Z0-9-_]+$` and be ≤ 32 chars. |
| Configuration wizard: memory store dropdown empty | No Memory Store exists yet on the account, or your role lacks read access | Create one via §2, or use **Create new memory store** on the same wizard step. |
| Grouping type field greyed out on edit | Immutable after creation | Create a new Configuration with the correct grouping. Close conversations on the old one so new traffic doesn't split. |
| VOICE calls not captured | Missing `conversationConfiguration` in TwiML | Check `src/server.js` — the `/twiml` handler must emit `<ConversationRelay conversationConfiguration="${TWILIO_CONVERSATION_CONFIGURATION_ID}">`. TAC does this automatically if `TWILIO_CONVERSATION_CONFIGURATION_ID` is set. |
| Double STT charges on Voice | "Set up automatic capture" was checked on the Voice traffic wizard step **while** ConversationRelay TwiML is also passing `conversationConfiguration` | GET the Configuration via API, remove `captureRules` from `channelSettings.VOICE` (keep the `VOICE` key itself so lifecycle timeouts persist), then PUT the whole object back. §4.4 warning. |
| `Invalid webhook payload` in `npm run dev` logs for SMS | The phone number's "A message comes in" webhook (or a Messaging Service's Inbound Request URL) is set to your `/webhook` URL and pushing raw Twilio SMS bodies (`Body`, `From`, `To`…). TAC's `/webhook` only accepts Conversation Orchestrator events. | Clear the number's Messaging Configuration URL per §6.4 and verify the CO Configuration's `statusCallbacks` is set per §4.2. If a Messaging Service is attached, set its Inbound Request URL to blank or check **Defer to sender's webhook**. |
| Every inbound SMS produces two Communications and two AI replies | Both sender and receiver are Twilio numbers in the *same* account (typically `twilio dev-phone` from this account texting the agent number). Twilio creates two Message resources per intra-account SMS (`outbound-api` + `inbound`, same from/to). The CO capture rule matches both and creates two Communications. | Test from a real cell phone, or run `twilio dev-phone` from a **different** Twilio account than the one hosting the agent number. See §1 warning. This is not a code bug — it's an intra-account testing artifact. |
| Profile phone doesn't match calls | `phone` identifier rule missing or number not in E.164 | Check **Conversation Memory → Settings → Identifiers** — `phone` must be listed. Re-seed profile with E.164 phone (`+1…`). |
| Recall returns empty right after seeding | Indexing lag | Wait 30s after last observation write. Semantic index is async. |
| Configuration count at 10 | Hard limit per account | Section 8 — delete unused configs. Hard limit is 10 per account. |
| Memory Store count at 15 | Hard limit per account | Delete unused stores, or move workloads to sub-accounts. |
| Console UI paths differ from this doc | Twilio ships UI changes frequently | Use `⌘K` search: "Conversation Memory", "Conversation configurations", "Active numbers". Product areas — **Phone Numbers**, **Conversation Orchestrator**, **Conversation Memory** — are stable under **Products & services**. |

---

## Reference

- **Console:** [`https://console.twilio.com/`](https://console.twilio.com/)
- **Conversation Orchestrator quickstart:** [`https://www.twilio.com/docs/conversations/orchestrator/quickstart`](https://www.twilio.com/docs/conversations/orchestrator/quickstart)
- **Conversation Memory — Getting started:** [`https://www.twilio.com/docs/conversations/memory/getting-started`](https://www.twilio.com/docs/conversations/memory/getting-started)
- **Conversation Memory — Memory stores:** [`https://www.twilio.com/docs/conversations/memory/memory-stores`](https://www.twilio.com/docs/conversations/memory/memory-stores)
- **TAC TypeScript SDK:** [`https://github.com/twilio/twilio-agent-connect-typescript`](https://github.com/twilio/twilio-agent-connect-typescript)
- **Helper scripts (equivalent to this walkthrough, CLI-based):**
  `helpers/setup/`, `helpers/profile/` (invoke via `npm run setup` and
  `npm run profile`)
