# AGENTS.md

Guidance for AI agents working in this repository.

## Project Goal

This repo is a JavaScript port of the Owl Airlines voice + SMS AI agent demo. It uses Twilio Agent
Connect (TAC), Conversation Orchestrator, and Conversation Memory to route inbound Voice and SMS
into a single OpenAI-backed agent with tool calling and a small operator dashboard.

## Current Scope

- Voice channel via TAC (Twilio ConversationRelay under the hood)
- SMS channel via TAC (Messaging webhook)
- Conversation Orchestrator groups Voice + SMS into one conversation
- Conversation Memory profile lookup and Recall injected into the system prompt
- OpenAI tool calling against local Owl Airlines demo tools
- Lightweight dashboard for observing state

Explicitly NOT included in this port:

- Conversation Intelligence in app code (no `/ci-webhook`). The demo configures it manually in the
  Console instead; see `assets/conversation-intelligence.md`.
- Studio handoff flow
- Production persistence (all demo state is in-memory)

## Conventions

- Small, scoped changes. Do not add unrelated Twilio products or refactor across module boundaries.
- No secrets in code. Use `.env.example` as the source of truth for configuration.
- Node.js 22.13+, ESM, plain JavaScript (no TypeScript in application source).
- Fastify is owned by our code, then handed to TAC via `TACConfig.fastifyInstance`.

## Module Map

Application code lives under `src/`:

- `src/core/` - prompts, config loading, static asset helpers
- `src/integrations/` - TAC, OpenAI, Memory adapters
- `src/repositories/` - in-memory demo and dashboard state
- `src/routes/` - Fastify route modules
- `src/services/` - agent orchestration on the TAC `messageReady` path
- `src/tools/` - OpenAI tool schemas and handlers (Owl Airlines lookups, SMS)
- `src/static/` - dashboard assets

Keep routes thin: validate at the edge, then delegate to a service. Keep the TAC message-ready
handler as the single place where Memory context, tool calls, and dashboard state come together.

## Twilio Integration

- All Twilio config is env-var driven; never hard-code SIDs, keys, phone numbers, or ngrok URLs.
- TAC handles both the Voice ConversationRelay wiring and the SMS webhook.
- Do NOT add passive VOICE capture rules to the Orchestrator Configuration. TAC delivers Voice via
  active TwiML, and combining that with passive capture causes double STT billing.
- Preserve adapter boundaries so local runs can mock or bypass live Twilio resources.

## Fixtures and Helpers

- `assets/` contains language-agnostic demo fixtures (e.g. `trip.json`). Do not modify.
- `assets/knowledge/` holds the Owl Air policy KB articles (luggage, pets) used as agent knowledge.
- `assets/conversation-intelligence.md` is the manual Console walkthrough for Conversation Intelligence (operators, config, rule).
- `helpers/setup/` provisions Memory Store, Conversation Configuration, and Orchestrator wiring.
- `helpers/profile/` provisions the Memory profile, trait groups, and observations for Avery Stone.

## Verification

- `npm install` installs `twilio-agent-connect` from npm along with the rest of the deps.
- `npm start` boots Fastify on `PORT` (default 8000). Expect startup log lines from TAC indicating
  the Voice and SMS channels are registered and Fastify is listening.
- `npm run dev` is an alias for `npm start`.
