#!/usr/bin/env bash
set -e

# Attach a Conversation Intelligence configuration to Conversation Orchestrator.
# Usage: ./helpers/setup/4_update_conversation_config.sh
# Usage: ./helpers/setup/4_update_conversation_config.sh <CONVERSATION_INTELLIGENCE_CONFIGURATION_ID>
# Usage: ./helpers/setup/4_update_conversation_config.sh <TWILIO_CONVERSATION_CONFIGURATION_ID> <CONVERSATION_INTELLIGENCE_CONFIGURATION_ID>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth

if [ -n "${2:-}" ]; then
    TWILIO_CONVERSATION_CONFIGURATION_ID="$1"
    CONVERSATION_INTELLIGENCE_CONFIGURATION_ID="$2"
elif [ -n "${1:-}" ]; then
    CONVERSATION_INTELLIGENCE_CONFIGURATION_ID="$1"
fi

require_env TWILIO_CONVERSATION_CONFIGURATION_ID
require_env CONVERSATION_INTELLIGENCE_CONFIGURATION_ID

CONVERSATION_CONFIG_URL="https://conversations.twilio.com/v2/ControlPlane/Configurations/$TWILIO_CONVERSATION_CONFIGURATION_ID"

echo "Reading Conversation Configuration..."
echo "GET $CONVERSATION_CONFIG_URL"
echo ""

CURRENT_CONFIG=$(twilio_json GET "$CONVERSATION_CONFIG_URL")

REQUEST_BODY=$(echo "$CURRENT_CONFIG" | jq \
    --arg intelligenceConfigId "$CONVERSATION_INTELLIGENCE_CONFIGURATION_ID" \
    '{
    displayName,
    description,
    conversationGroupingType,
    memoryStoreId,
    memoryExtractionEnabled,
    channelSettings,
    statusCallbacks,
    conversationsV1Bridge
  }
  | with_entries(select(.value != null))
  | .description = "Owl Airlines Conversation Orchestrator with Memory and Intelligence"
  | .memoryExtractionEnabled = true
  | .intelligenceConfigurationIds = [$intelligenceConfigId]')

echo "Attaching Intelligence Configuration..."
echo "PUT $CONVERSATION_CONFIG_URL"
echo "$REQUEST_BODY" | jq .
echo ""

RESPONSE=$(twilio_json PUT "$CONVERSATION_CONFIG_URL" "$REQUEST_BODY")
echo "$RESPONSE" | jq .

STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl // empty')
if [ -n "$STATUS_URL" ]; then
    wait_for_operation "$STATUS_URL" "Conversation Configuration update" >/dev/null
fi

echo ""
echo "Verifying Conversation Configuration..."

for ATTEMPT in 1 2 3 4 5; do
    UPDATED_CONFIG=$(twilio_json GET "$CONVERSATION_CONFIG_URL")

    if echo "$UPDATED_CONFIG" | jq -e --arg id "$CONVERSATION_INTELLIGENCE_CONFIGURATION_ID" \
        '.intelligenceConfigurationIds // [] | index($id)' >/dev/null; then
        echo "Verified Intelligence Configuration is attached."
        break
    fi

    if [ "$ATTEMPT" = "5" ]; then
        echo "Could not verify Intelligence Configuration attachment yet."
        echo "Check the Conversation Configuration manually:"
        echo "$CONVERSATION_CONFIG_URL"
        exit 1
    fi

    echo "Waiting for Conversation Configuration to reflect the update..."
    sleep 3
done

echo ""
echo "Conversation Configuration linked to Intelligence:"
echo "TWILIO_CONVERSATION_CONFIGURATION_ID=$TWILIO_CONVERSATION_CONFIGURATION_ID"
echo "CONVERSATION_INTELLIGENCE_CONFIGURATION_ID=$CONVERSATION_INTELLIGENCE_CONFIGURATION_ID"
