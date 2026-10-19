#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

extract_env_value() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key {print substr($0, length(key) + 2)}' | tail -n 1
}

require_output_value() {
  local name="$1"
  local value="$2"

  if [ -z "$value" ]; then
    echo "Could not find $name in the previous script output." >&2
    exit 1
  fi
}

echo "=========================================="
echo "Owl Airlines Twilio Conversation Services"
echo "=========================================="
echo ""

echo "Step 1: Create Memory Store"
MEMORY_OUTPUT="$("$SCRIPT_DIR/1_create_memory_store.sh")"
echo "$MEMORY_OUTPUT"
MEMORY_STORE_ID="$(echo "$MEMORY_OUTPUT" | extract_env_value "TWILIO_MEMORY_STORE_ID")"
require_output_value TWILIO_MEMORY_STORE_ID "$MEMORY_STORE_ID"
echo ""

echo "Step 2: Create Conversation Configuration"
CONVERSATION_OUTPUT="$("$SCRIPT_DIR/2_create_conversation_config.sh" "$MEMORY_STORE_ID")"
echo "$CONVERSATION_OUTPUT"
CONVERSATION_CONFIG_ID="$(echo "$CONVERSATION_OUTPUT" | extract_env_value "TWILIO_CONVERSATION_CONFIGURATION_ID")"
require_output_value TWILIO_CONVERSATION_CONFIGURATION_ID "$CONVERSATION_CONFIG_ID"
echo ""

echo "Step 3: Create Intelligence Configuration"
INTELLIGENCE_OUTPUT="$("$SCRIPT_DIR/3_create_intelligence_config.sh")"
echo "$INTELLIGENCE_OUTPUT"
SENTIMENT_OPERATOR_ID="$(echo "$INTELLIGENCE_OUTPUT" | extract_env_value "TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID")"
INTENT_RECOGNITION_OPERATOR_ID="$(echo "$INTELLIGENCE_OUTPUT" | extract_env_value "TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID")"
OFFER_COUPON_OPERATOR_ID="$(echo "$INTELLIGENCE_OUTPUT" | extract_env_value "TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID")"
SUMMARY_OPERATOR_ID="$(echo "$INTELLIGENCE_OUTPUT" | extract_env_value "TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID")"
INTELLIGENCE_CONFIG_ID="$(echo "$INTELLIGENCE_OUTPUT" | extract_env_value "CONVERSATION_INTELLIGENCE_CONFIGURATION_ID")"
require_output_value TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID "$SENTIMENT_OPERATOR_ID"
require_output_value TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID "$INTENT_RECOGNITION_OPERATOR_ID"
require_output_value TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID "$OFFER_COUPON_OPERATOR_ID"
require_output_value TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID "$SUMMARY_OPERATOR_ID"
require_output_value CONVERSATION_INTELLIGENCE_CONFIGURATION_ID "$INTELLIGENCE_CONFIG_ID"
echo ""

echo "Step 4: Attach Intelligence to Conversation Orchestrator"
ATTACH_OUTPUT="$("$SCRIPT_DIR/4_update_conversation_config.sh" "$CONVERSATION_CONFIG_ID" "$INTELLIGENCE_CONFIG_ID")"
echo "$ATTACH_OUTPUT"
echo ""

echo "Step 5: Create Studio Handoff Flow"
HANDOFF_OUTPUT="$("$SCRIPT_DIR/5_create_studio_handoff_flow.sh")"
echo "$HANDOFF_OUTPUT"
STUDIO_HANDOFF_FLOW_SID="$(echo "$HANDOFF_OUTPUT" | extract_env_value "TWILIO_STUDIO_HANDOFF_FLOW_SID")"
require_output_value TWILIO_STUDIO_HANDOFF_FLOW_SID "$STUDIO_HANDOFF_FLOW_SID"
echo ""

echo "=========================================="
echo "Setup complete"
echo "=========================================="
echo ""
echo "Add these values to .env:"
echo "TWILIO_MEMORY_STORE_ID=$MEMORY_STORE_ID"
echo "TWILIO_CONVERSATION_CONFIGURATION_ID=$CONVERSATION_CONFIG_ID"
echo "CONVERSATION_INTELLIGENCE_CONFIGURATION_ID=$INTELLIGENCE_CONFIG_ID"
echo "TWILIO_STUDIO_HANDOFF_FLOW_SID=$STUDIO_HANDOFF_FLOW_SID"
echo ""
echo "Intelligence operator IDs:"
echo "TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID=$SENTIMENT_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID=$INTENT_RECOGNITION_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID=$OFFER_COUPON_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID=$SUMMARY_OPERATOR_ID"
echo ""
echo "Cleanup dry run:"
echo "helpers/setup/0_cleanup.sh"
echo ""
echo "Cleanup apply:"
echo "helpers/setup/0_cleanup.sh --yes"
