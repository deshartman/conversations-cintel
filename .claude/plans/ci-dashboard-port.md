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
- Twilio docs: Rule Execution webhook payload (`accountId`, `conversationId`,
  `intelligenceConfiguration.id`, `operatorResults[].operator.displayName`, `outputFormat`, `result`,
  `dateCreated`, `executionDetails`).
- Operator definitions: `assets/conversation-intelligence.md`.

## Plan

### Phase 1: backend (done)

- [x] Plan file
- [x] `src/server.js`: pass `webhookPaths: { cintel: '/ci-webhook' }` to `TACServer` only when
      `TWILIO_TAC_CI_CONFIGURATION_ID` is set
- [x] `src/server.js`: Fastify `preValidation` hook copies `/ci-webhook` and `/webhook` POST bodies
      into dashboard state before TAC's route (and its signature preHandler) runs
- [x] `src/services/capture.js`: `formatCiResult` (port of `_format_ci_result`), `ciSignal`,
      `ciSignals`, `captureCiPayload`, `captureOrchestratorPayload`
- [x] `src/repositories/conversations.js`: CI + Orchestrator event stores, capped at 200 per conversation
- [x] `GET /api/sessions/:id/events`: time-ordered timeline (messages, tools, orchestrator, intelligence)
- [x] `GET /api/sessions/:id/signals`: latest intent / offer_coupon plus change history
- [x] `.env.example`: `TWILIO_TAC_CI_CONFIGURATION_ID`, `TWILIO_TAC_CI_SUMMARY_OPERATOR_SID`
- [x] Verification: `node --check`, formatter unit check, boot on 8010, 3-turn mock

### Phase 2: UI

- [ ] Port the upstream layout to `/` (sessions list, transcript, Agent Context, Events, History)
- [ ] Events timeline built on `/api/sessions/:id/events`, with Orchestrator / Intelligence / Tool
      badges; `offer-coupon` YES highlighted
- [ ] "Current signals" block in Agent Context built on `/api/sessions/:id/signals`
- [ ] Poll events + signals (~1-2s) for the selected session so results appear without reload
- [ ] Remaining upstream APIs as the UI needs them: `/api/sessions`, `/api/sessions/:id/messages`,
      `/api/sessions/:id/context`, `/api/profiles/:id/memory`, `/api/history`,
      `/api/history/:id/messages` (TAC `getMemoryClient().getProfile/retrieveMemories`,
      `getConversationClient().listConversations/listCommunications`)
- [ ] Tool events: record `running` before the handler and update to `completed`/`failed`
      (upstream shape) in `src/services/agent.js`

### Phase 3: docs

- [ ] `assets/conversation-intelligence.md`: webhook action to
      `https://$TWILIO_VOICE_PUBLIC_DOMAIN/ci-webhook`, live trigger (during the conversation), config
      ID must match `TWILIO_TAC_CI_CONFIGURATION_ID`, remove the "no /ci-webhook route" warning
- [ ] README / AGENTS.md / CLAUDE.md: new routes, env vars, `/ci-webhook` only when the var is set
      (AGENTS.md "Explicitly NOT included" currently says no `/ci-webhook`)

## Decisions

- **Capture hook is `preValidation`, global, path-matched.** TAC's `/ci-webhook` and `/webhook` routes
  validate the Twilio signature in a route-level `preHandler`. A global `preValidation` hook runs after
  JSON body parsing and before that, so capture happens even when TAC replies 403/400 (same semantics
  as upstream's Starlette middleware). Path match ignores the query string.
- **Every operator result is kept**, regardless of operator. TAC's `OperatorResultProcessor` only acts
  on the configured summary operator and skips everything else; capture is independent of that.
- **Cap is 200 events per conversation per store** (upstream behaviour), in a module-level Map.
- **Formatter** (`formatCiResult`): `offer-coupon` -> `Offer coupon: YES` / `Offer coupon: no`;
  `Intent-Recognition` -> `Intent: <description>`; then upstream's key order
  (`label`, `text`, `summary`, `description`, `result`), then `summaries[]` joined, then a generic
  `key: value, ...` list of JSON output fields. Strings pass through. 500-char cap. Operator names are
  normalised (lowercase, `_`/space -> `-`) before matching, as upstream does.
- **Signals**: each CI event carries `signal: {type: 'intent'|'offer_coupon', value}` or `null`.
  `/signals` sorts by `created_at`; `history` records value *changes* only (false -> true), `latest`
  is the most recent value.
- **Orchestrator events** come from the same hook on `/webhook` (CO `statusCallbacks`), so they show
  only for traffic that reaches the app. No new Twilio webhook config is needed or suggested.
- **`/events` and `/signals` return 200 with empty arrays for unknown IDs** (not 404 like upstream),
  because CI/CO webhooks can arrive before the agent has a dashboard record for the conversation.
- **Existing record shapes unchanged.** `transcript` (`role: caller|agent`, `text`, `at`) and
  `toolEvents` (`name`, `args`, `result`, `at`) stay as they are so the current UI keeps working;
  `/events` maps them to upstream names (`role: user|assistant`, `content`, `tool`, `arguments`,
  `created_at`).
- **`/ci-webhook` gating**: route is not registered at all without `TWILIO_TAC_CI_CONFIGURATION_ID`
  (404), rather than TAC's 400.

## Deviations from Python

- Starlette middleware -> Fastify `preValidation` hook.
- `ci_events` gains `id`, `operator_id`, `signal`; `created_at` falls back to capture time.
- `operator` falls back to `operator.name` / `operator.id` when `displayName` is missing.
- Orchestrator events are captured from `/webhook` bodies; upstream derived them from
  `list_communications` on each context load.
- New `/api/sessions/:id/signals` endpoint (no upstream equivalent).
- `/events` returns a merged `events[]` timeline in addition to upstream's `ci_events` / `tool_events`.
- Formatter: friendly `Intent:` / `Offer coupon:` strings, generic field list for unknown JSON
  operators, and `summaries[]` support.

## UI mapping

| Upstream element | JS element | Status |
| --- | --- | --- |
| CIEventCaptureMiddleware | `preValidation` hook in `src/server.js` + `captureCiPayload` | Phase 1 done |
| `_format_ci_result` | `formatCiResult` in `src/services/capture.js` | Phase 1 done |
| `/api/sessions/{id}/events` | `/api/sessions/:id/events` | Phase 1 done |
| (none) Current signals | `/api/sessions/:id/signals` | Phase 1 done (API); Phase 2 (UI) |
| Session list `/api/sessions` | TBD | Phase 2 |
| Transcript `/api/sessions/{id}/messages` | TBD | Phase 2 |
| Agent Context: Profile / Observations / Summaries / Communications `/context` | TBD | Phase 2 |
| Profile hover popover `/api/profiles/{id}/memory` | TBD | Phase 2 |
| Events feed (Orchestrator / Intelligence / Tool badges) | built on `/events` | Phase 2 |
| History `/api/history`, `/api/history/{id}/messages` | TBD | Phase 2 |
| Stats bar, sidebar toggle, resizable panels | TBD | Phase 2 |

## Verification

Phase 1, run 2026-10-20 in the worktree.

`node --check` (all ok): `src/server.js`, `src/routes/dashboard.js`, `src/services/capture.js`,
`src/repositories/conversations.js`.

Formatter (`node -e "import('./src/services/capture.js')..."`):

```
["Intent-Recognition","JSON"] -> "Intent: Change seats" | signal {"type":"intent","value":"Change seats"}
["offer-coupon","JSON"] -> "Offer coupon: YES" | signal {"type":"offer_coupon","value":true}
["offer-coupon","JSON"] -> "Offer coupon: no" | signal {"type":"offer_coupon","value":false}
["Sentiment","CLASSIFICATION"] -> "negative" | signal null
["Summary","TEXT"] -> "Avery asked to move to a window seat on OA404." | signal null
["Summary","JSON"] -> "Avery changed seat to 3A." | signal null
["Next Best Response","TEXT"] -> "Apologise for the delay and offer a voucher." | signal null
["Custom Thing","JSON"] -> "risk: high, score: 0.82, tags: [\"delay\"]" | signal null
["Empty","JSON"] -> "JSON" | signal null
```

Boot: temp `.env` (gitignored) with `PORT=8010`,
`TWILIO_TAC_CI_CONFIGURATION_ID=intelligence_configuration_01m5czn8qffknrd9d5nqq54b7p`,
`TAC_ANALYTICS_DISABLED=true`, no summary operator SID. Log shows `"cintel_webhook":"/ci-webhook"`,
`TAC Server started`. `GET /healthz` -> `{"status":"ok"}`, `GET /` -> 200.

Mock (`/tmp/ci-mock/post_turn.mjs <n>`, conversation `conv_conversation_01mockavery0000000000000001`),
each turn = one CO `COMMUNICATION_CREATED` to `/webhook` (unsigned -> TAC 403, captured) + one CI
payload to `/ci-webhook` with `Intent-Recognition`, `offer-coupon`, `Sentiment`:

| Turn | `/webhook` | `/ci-webhook` (TAC) | `/signals` after |
| --- | --- | --- | --- |
| 1 "I want to change my seat on OA404" | 403 | 403 (unsigned) | intent Change seats; coupon false |
| 2 "also add a checked bag" | 403 | 200 `{"success":true,"skipped":true,"skipReason":"All operator results were skipped","createdCount":0}` (signed) | intent history Change seats -> Add check-in baggage; coupon false |
| 3 "my flight is delayed again, this is ridiculous" | 403 | 200 same (signed) | intent history ... -> Loyalty recovery; coupon false -> true |

`/events` after turn 3: 12 items in time order, an orchestrator `COMMUNICATION_CREATED` followed by
three intelligence items per turn (`Intent: ...`, `Offer coupon: no|YES`, sentiment). Capture worked
both when TAC rejected (403) and accepted (200). TAC wrote nothing to Memory (summary operator unset).

## Open questions

- Which CI configuration ID should `TWILIO_TAC_CI_CONFIGURATION_ID` hold?
  `intelligence_configuration_01m5czn8qffknrd9d5nqq54b7p` or
  `intelligence_configuration_01m5czzhr7f35sm1x6g71sqert`. Both are attached to the CoR config, but
  TAC accepts only one. It must be the one whose rule has the webhook action. Capture itself does not
  filter by config ID, so the dashboard shows results from either. Only TAC's processing is filtered.
- Known quirk: the first SMS of a new conversation got no COMMUNICATION_CREATED. The `/webhook`
  capture will make this visible in the Events feed (Phase 2) but does not fix it.
- Real CI webhooks are signed against the public URL. TAC validates using `X-Forwarded-Proto/Host`, so
  the tunnel must forward the host. Capture is unaffected either way.
