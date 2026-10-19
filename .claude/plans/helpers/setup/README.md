# Setup Helpers

Scripts for provisioning the Twilio Conversation Services resources used by the Owl Airlines demo.

## Flow

The setup creates and links these resources:

1. Memory Store
2. Conversation Orchestrator configuration
3. Conversation Intelligence configuration
4. Intelligence attachment to Conversation Orchestrator
5. Studio handoff Flow that forwards voice handoff calls to a demo specialist number

## Prerequisites

Copy the example env file and add your Twilio credentials:

```bash
cp .env.example .env
```

At minimum, set:

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
DEMO_SPECIALIST_PHONE_NUMBER=
```

The Intelligence setup intentionally uses one operator per signal: sentiment, intent recognition,
offer coupon, and summary. `3_create_intelligence_config.sh` lists available operators, resolves the
IDs for the current Twilio account, creates the custom OwlAir operators when needed, and prints the
`TWILIO_INTELLIGENCE_*_OPERATOR_ID` values to copy into `.env` for the running app.

By default, the helper looks for or creates custom operators named `Intent-Recognition` and
`Offer-Coupon`. Override those names if needed:

```bash
TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_NAME=
TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_NAME=
```

## Usage

Run the full setup:

```bash
./helpers/setup/run_all.sh
```

The script prints the generated IDs at the end. Copy them into `.env`:

```bash
TWILIO_MEMORY_STORE_ID=
TWILIO_CONVERSATION_CONFIGURATION_ID=
CONVERSATION_INTELLIGENCE_CONFIGURATION_ID=
TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID=
TWILIO_STUDIO_HANDOFF_FLOW_SID=
```

Run individual steps when demoing the API calls:

```bash
./helpers/setup/1_create_memory_store.sh
./helpers/setup/2_create_conversation_config.sh <TWILIO_MEMORY_STORE_ID>
./helpers/setup/3_create_intelligence_config.sh
./helpers/setup/4_update_conversation_config.sh <TWILIO_CONVERSATION_CONFIGURATION_ID> <CONVERSATION_INTELLIGENCE_CONFIGURATION_ID>
./helpers/setup/5_create_studio_handoff_flow.sh
```

The Intelligence configuration contains two rules:

- A real-time `COMMUNICATION` rule with Sentiment, Intent Recognition, and Offer Coupon operators.
- A post-interaction `CONVERSATION_END` rule with only the Summary operator.

Both rules send results to `https://$TWILIO_VOICE_PUBLIC_DOMAIN/ci-webhook`.

The Studio handoff Flow uses `DEMO_SPECIALIST_PHONE_NUMBER` as the forwarding target and
`TWILIO_PHONE_NUMBER` as the caller ID.

Cleanup is dry-run by default:

```bash
./helpers/setup/0_cleanup.sh
./helpers/setup/0_cleanup.sh --yes
```

You can also clean up one resource by ID:

```bash
./helpers/setup/0_cleanup.sh memory <TWILIO_MEMORY_STORE_ID>
./helpers/setup/0_cleanup.sh conversation <TWILIO_CONVERSATION_CONFIGURATION_ID>
./helpers/setup/0_cleanup.sh intelligence <CONVERSATION_INTELLIGENCE_CONFIGURATION_ID>
./helpers/setup/0_cleanup.sh studio <TWILIO_STUDIO_HANDOFF_FLOW_SID>
```
