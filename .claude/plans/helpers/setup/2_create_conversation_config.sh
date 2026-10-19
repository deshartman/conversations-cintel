#!/usr/bin/env bash
set -e

# Create Conversation Orchestrator configuration for Owl Airlines.
# Usage: ./helpers/setup/2_create_conversation_config.sh
# Usage: ./helpers/setup/2_create_conversation_config.sh <TWILIO_MEMORY_STORE_ID>
# Docs: https://www.twilio.com/docs/conversations/conversation-orchestrator

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth
require_env TWILIO_PHONE_NUMBER

if [ -n "${1:-}" ]; then
    TWILIO_MEMORY_STORE_ID="$1"
fi

require_env TWILIO_MEMORY_STORE_ID

# Generate a unique display name with timestamp.
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DISPLAY_NAME="${CONVERSATION_CONFIG_NAME:-OwlAir}-${TIMESTAMP}"

CONVERSATION_CONFIG_URL="https://conversations.twilio.com/v2/ControlPlane/Configurations"

REQUEST_BODY=$(cat <<EOF
{
  "displayName": "$DISPLAY_NAME",
  "description": "Owl Airlines omnichannel Conversation Orchestrator configuration",
  "conversationGroupingType": "GROUP_BY_PROFILE",
  "memoryStoreId": "$TWILIO_MEMORY_STORE_ID",
  "memoryExtractionEnabled": true,
  "channelSettings": {
    "SMS": {
      "captureRules": [
        {"from": "$TWILIO_PHONE_NUMBER", "to": "*", "metadata": {}},
        {"from": "*", "to": "$TWILIO_PHONE_NUMBER", "metadata": {}}
      ],
      "statusTimeouts": {"inactive": 10, "closed": 60}
    },
    "WHATSAPP": {
      "captureRules": [
        {"from": "$TWILIO_PHONE_NUMBER", "to": "*", "metadata": {}},
        {"from": "*", "to": "$TWILIO_PHONE_NUMBER", "metadata": {}}
      ],
      "statusTimeouts": {"inactive": 10, "closed": 60}
    },
    "RCS": {
      "captureRules": [
        {"from": "$TWILIO_PHONE_NUMBER", "to": "*", "metadata": {}},
        {"from": "*", "to": "$TWILIO_PHONE_NUMBER", "metadata": {}}
      ],
      "statusTimeouts": {"inactive": 10, "closed": 60}
    },
    "VOICE": {
      "statusTimeouts": null
    }
  }
}
EOF
)

echo "Creating Conversation Configuration: $DISPLAY_NAME"
echo "POST $CONVERSATION_CONFIG_URL"
echo "$REQUEST_BODY" | jq .
echo ""
echo "Note: VOICE has no passive captureRules because TAC/ConversationRelay uses active ingestion."
echo ""

RESPONSE=$(twilio_json POST "$CONVERSATION_CONFIG_URL" "$REQUEST_BODY")
echo "$RESPONSE" | jq .
echo ""

CONVERSATION_CONFIG_ID=$(extract_operation_result_id "$RESPONSE" "Conversation Configuration creation")

echo "Conversation Configuration created:"
echo "TWILIO_CONVERSATION_CONFIGURATION_ID=$CONVERSATION_CONFIG_ID"
