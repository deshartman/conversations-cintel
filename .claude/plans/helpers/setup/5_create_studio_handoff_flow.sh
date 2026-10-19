#!/usr/bin/env bash
set -e

# Create a Studio Flow for TAC human handoff.
# Usage: ./helpers/setup/5_create_studio_handoff_flow.sh
# Docs: https://www.twilio.com/docs/studio/rest-api/v2/flow

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth
require_env TWILIO_PHONE_NUMBER
require_env DEMO_SPECIALIST_PHONE_NUMBER

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FRIENDLY_NAME="${STUDIO_HANDOFF_FLOW_NAME:-OwlAir-Handoff}-${TIMESTAMP}"
STUDIO_FLOWS_URL="https://studio.twilio.com/v2/Flows"

DEFINITION=$(jq -n \
    --arg specialist "$DEMO_SPECIALIST_PHONE_NUMBER" \
    --arg callerId "$TWILIO_PHONE_NUMBER" \
    '{
      description: "Owl Airlines TAC handoff flow. Forwards a voice handoff to the demo specialist phone number.",
      states: [
        {
          name: "Trigger",
          type: "trigger",
          transitions: [
            {event: "incomingCall", next: "connect_to_specialist"},
            {event: "incomingRequest", next: "connect_to_specialist"},
            {event: "incomingMessage", next: "message_not_supported"}
          ],
          properties: {
            offset: {x: 0, y: 0}
          }
        },
        {
          name: "connect_to_specialist",
          type: "connect-call-to",
          transitions: [
            {event: "callCompleted"},
            {event: "hangup"}
          ],
          properties: {
            offset: {x: 260, y: 0},
            noun: "number",
            to: $specialist,
            caller_id: $callerId,
            timeout: 30
          }
        },
        {
          name: "message_not_supported",
          type: "send-message",
          transitions: [
            {event: "sent"},
            {event: "failed"}
          ],
          properties: {
            offset: {x: 260, y: 180},
            from: $callerId,
            body: "An Owl Airlines specialist will follow up with you shortly."
          }
        }
      ],
      initial_state: "Trigger",
      flags: {
        allow_concurrent_calls: true
      }
    }')

echo "Creating Studio handoff Flow: $FRIENDLY_NAME"
echo "POST $STUDIO_FLOWS_URL"
echo "$DEFINITION" | jq .
echo ""

RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST "$STUDIO_FLOWS_URL" \
    -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
    --data-urlencode "FriendlyName=$FRIENDLY_NAME" \
    --data-urlencode "Status=published" \
    --data-urlencode "CommitMessage=Create Owl Airlines TAC handoff flow" \
    --data-urlencode "Definition=$DEFINITION")

HTTP_STATUS="$(echo "$RESPONSE" | tail -n 1)"
RESPONSE="$(echo "$RESPONSE" | sed '$d')"

if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    echo "Twilio Studio API request failed: HTTP $HTTP_STATUS" >&2
    echo "$RESPONSE" >&2
    exit 1
fi

echo "$RESPONSE" | jq .
echo ""

STUDIO_HANDOFF_FLOW_SID="$(echo "$RESPONSE" | jq -r '.sid // empty')"
if [ -z "$STUDIO_HANDOFF_FLOW_SID" ]; then
    echo "Could not find Studio Flow SID in response." >&2
    echo "$RESPONSE" >&2
    exit 1
fi

echo "Studio handoff Flow created:"
echo "TWILIO_STUDIO_HANDOFF_FLOW_SID=$STUDIO_HANDOFF_FLOW_SID"
