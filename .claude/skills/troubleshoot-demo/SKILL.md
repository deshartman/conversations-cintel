---
name: troubleshoot-demo
description: Diagnose a failing Owl Airlines demo (voice call not answered, SMS errors or duplicate replies, memory not recalled, tool/SMS send failures). Use when the user reports the running agent misbehaving.
---

# Troubleshoot the running demo

Start from the `npm start` logs (Fastify logger is on), then `GET /api/conversations` for the
transcript and `toolEvents`. Full table: RUNBOOK_SETUP.md §9 and RUNBOOK.md "Fallback plans".

| Symptom | Check |
|---|---|
| Any 401 with code `20003` "Terms of service have not been accepted" (boot, helpers, or preflight) | The account hasn't accepted the Conversations terms. Console → Conversation Memory → Overview → "Upgrade your account for full access" (RUNBOOK_SETUP.md §2.2). Re-check with `npm run preflight`. |
| Boot fails "Missing required environment variable" | TAC needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_PHONE_NUMBER`. |
| Boot fails "Messaging channels require conversationConfigurationId" | `TWILIO_CONVERSATION_CONFIGURATION_ID` unset. |
| Boot fails "Invalid Conversation Configuration ID format" | ID must match `conv_configuration_` + 26 lowercase alphanumerics. |
| Boot fails "Failed to get configuration: ... 401" / 404 | TAC fetches the Configuration at startup: credentials wrong, or the ID belongs to another account or was deleted. |
| Call goes to voicemail / no `/twiml` hit | Number's Voice webhook = `https://<tunnel>/twiml` POST, and `TWILIO_VOICE_PUBLIC_DOMAIN` = current tunnel host (no scheme). ngrok URLs churn. |
| Voice not captured as a conversation | `TWILIO_CONVERSATION_CONFIGURATION_ID` set (TAC embeds it in ConversationRelay TwiML). |
| `Invalid webhook payload` on SMS | The number's (or Messaging Service's) inbound SMS webhook points at the app. Clear it. SMS must arrive only via the Configuration's `statusCallbacks` -> `/webhook`. |
| Two replies per SMS | Testing from dev-phone in the same Twilio account. Use a real phone or another account. |
| Double STT billing | Passive VOICE `captureRules` on the Configuration. Remove `captureRules` but keep the `VOICE` key. |
| Agent doesn't know Avery | Profile phone (E.164) must match the caller ID; traits populated; wait ~30s after seeding; `npm run profile:verify`. |
| `send_text_message` fails | App uses `TWILIO_API_KEY`/`TWILIO_API_SECRET` (not auth token), and needs `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_PHONE_NUMBER`. Recipient comes from the TAC author address, else `DEMO_CALLER_PHONE_NUMBER`. |
| "I'm having trouble finishing that" | Tool loop hit `MAX_TOOL_ITERATIONS` (5). Inspect `toolEvents` for repeated calls or errors. |

Don't edit Twilio Console resources or `.env` on the user's behalf without confirming first.
