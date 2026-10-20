# CI dashboard port

## Goal

Port the upstream Python dashboard and Conversation Intelligence (CI) capture into this JS app, so the
demo can show the **custom language operators** (`offer-coupon`, `Intent-Recognition`) firing turn by
turn next to the transcript, Orchestrator events and tool calls. Sentiment, summary and next best
response are secondary and are rendered generically.

## Source of truth

- Python original: `kuroxx/level-up-conversational-agents` branch `ep3`, `final/` (`dashboard.py`,
  `app.py`, `agent.py`, `static/`), checked out at `/tmp/luca-ep3/final/`.
- `twilio-agent-connect` 2.4.0 (`node_modules/twilio-agent-connect/dist/index.js`): `TACServer`
  `webhookPaths.cintel`, `OperatorResultProcessor`, `MemoryClient`, `ConversationClient`,
  `BaseChannel.activeConversations`.
- Twilio docs: Rule Execution webhook payload (`operatorResults[].operator.displayName`,
  `outputFormat`, `result`, `dateCreated`).
- Operator definitions: `assets/conversation-intelligence.md`.

## Plan

- [ ] Plan file
- [ ] CI capture: gate `webhookPaths.cintel` on `TWILIO_TAC_CI_CONFIGURATION_ID`, Fastify hook stores every operator result, port `_format_ci_result`
- [ ] Orchestrator capture: same hook records `/webhook` events (CONVERSATION_CREATED / COMMUNICATION_CREATED / CONVERSATION_UPDATED)
- [ ] Tool events with running/completed/failed status
- [ ] Dashboard APIs (`/api/sessions*`, `/api/profiles/:id/memory`, `/api/history*`)
- [ ] UI at `/` ported from upstream, plus timeline and Current signals
- [ ] `.env.example`, CLAUDE.md, AGENTS.md, README, `assets/conversation-intelligence.md`
- [ ] Verification: `node --check`, formatter unit check, boot on 8010, 3-turn mock

## Decisions

(filled in as work progresses)

## Deviations from Python

(filled in as work progresses)

## UI mapping

(filled in as work progresses)

## Verification

(filled in as work progresses)

## Open questions

- Which CI configuration ID should `TWILIO_TAC_CI_CONFIGURATION_ID` hold?
  `intelligence_configuration_01m5czn8qffknrd9d5nqq54b7p` or
  `intelligence_configuration_01m5czzhr7f35sm1x6g71sqert`. Both are attached to the CoR config, but
  TAC accepts only one. It must be the one whose rule has the webhook action.
- Known quirk: the first SMS of a new conversation got no COMMUNICATION_CREATED.
