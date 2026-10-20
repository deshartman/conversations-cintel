# Setup Helpers

Node.js scripts for provisioning the Twilio Conversation Services resources used by the Owl Airlines demo.

## Flow

The setup creates and links these resources:

1. Memory Store
2. Conversation Orchestrator configuration
3. Conversation Intelligence configuration
4. Intelligence attachment to Conversation Orchestrator

## Prerequisites

Install dependencies (once):

```bash
npm install
```

Copy the example env file and add your Twilio credentials:

```bash
cp .env.example .env
```

At minimum, set:

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

`TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID`, `TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID`, and
`TWILIO_INTELLIGENCE_NEXT_BEST_RESPONSE_OPERATOR_ID` are additionally required for step 3.

All scripts read `.env` from the repo root via `dotenv` and call the Twilio APIs through the
`twilio` npm package.

## Usage

Run the full setup:

```bash
npm run setup
```

It also seeds the passenger profile and trait groups (`helpers/profile/`) and, when
`TWILIO_VOICE_PUBLIC_DOMAIN` is set, points `TWILIO_PHONE_NUMBER`'s Voice webhook at
`https://<domain>/twiml` (`npm run setup:phone-number`). Intelligence (steps 3-4) is skipped unless
the operator ID vars are set.

Generated IDs are written into `.env` only when the key is missing or still a placeholder; a real
existing ID is reused instead of creating a new resource:

```bash
TWILIO_MEMORY_STORE_ID=
TWILIO_CONVERSATION_CONFIGURATION_ID=
TWILIO_MEMORY_PROFILE_ID=
TWILIO_INTELLIGENCE_CONFIGURATION_ID=
```

Run individual steps when demoing the API calls:

```bash
npm run setup:memory-store
npm run setup:conversation-config -- <TWILIO_MEMORY_STORE_ID>
npm run setup:intelligence-config
npm run setup:attach-intelligence -- <TWILIO_CONVERSATION_CONFIGURATION_ID> <TWILIO_INTELLIGENCE_CONFIGURATION_ID>
```

Or invoke them directly with `node`:

```bash
node helpers/setup/1_create_memory_store.js
node helpers/setup/2_create_conversation_config.js <TWILIO_MEMORY_STORE_ID>
node helpers/setup/3_create_intelligence_config.js
node helpers/setup/4_update_conversation_config.js <TWILIO_CONVERSATION_CONFIGURATION_ID> <TWILIO_INTELLIGENCE_CONFIGURATION_ID>
```

Cleanup is dry-run by default:

```bash
npm run setup:cleanup
npm run setup:cleanup:apply
```

You can also clean up one resource by ID:

```bash
node helpers/setup/0_cleanup.js memory <TWILIO_MEMORY_STORE_ID>
node helpers/setup/0_cleanup.js conversation <TWILIO_CONVERSATION_CONFIGURATION_ID>
node helpers/setup/0_cleanup.js intelligence <TWILIO_INTELLIGENCE_CONFIGURATION_ID>
```
