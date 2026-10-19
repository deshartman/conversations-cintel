#!/usr/bin/env bash
set -e

# Create Conversation Intelligence configuration for Owl Airlines.
# Usage: ./helpers/setup/3_create_intelligence_config.sh
# Docs: https://www.twilio.com/docs/conversations/conversation-intelligence

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth

# Generate a unique display name with timestamp.
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DISPLAY_NAME="${INTELLIGENCE_CONFIG_NAME:-OwlAir-Intelligence}-${TIMESTAMP}"

INTELLIGENCE_CONFIG_URL="https://intelligence.twilio.com/v3/ControlPlane/Configurations"
OPERATORS_BASE_URL="https://intelligence.twilio.com/v3/ControlPlane/Operators"
OPERATORS_URL="$OPERATORS_BASE_URL?pageSize=1000"
OFFER_COUPON_OPERATOR_NAME="${TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_NAME:-Offer-Coupon}"
INTENT_RECOGNITION_OPERATOR_NAME="${TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_NAME:-Intent-Recognition}"

resolve_operator_id() {
    local label="$1"
    local operator_id
    shift

    operator_id="$(echo "$OPERATORS_RESPONSE" | jq -r "$@")"
    if [ -z "$operator_id" ] || [ "$operator_id" = "null" ]; then
        echo "Could not find Conversation Intelligence operator: $label" >&2
        exit 1
    fi

    echo "$operator_id"
}

find_operator_id() {
    echo "$OPERATORS_RESPONSE" | jq -r "$@"
}

create_offer_coupon_operator() {
    local request_body
    local response
    local operator_id

    request_body=$(cat <<EOF
{
  "displayName": "$OFFER_COUPON_OPERATOR_NAME",
  "description": "Returns whether Owl Airlines should offer a recovery coupon.",
  "prompt": "Return true when the customer is frustrated, impacted by a delay or cancellation, or should receive a loyalty recovery gesture. Return false otherwise.",
  "outputFormat": "JSON",
  "outputSchema": {
    "type": "object",
    "properties": {
      "offer_coupon": {
        "type": "boolean",
        "description": "Whether Owl Airlines should offer a recovery coupon."
      }
    },
    "required": ["offer_coupon"],
    "additionalProperties": false
  }
}
EOF
)

    echo "Creating custom offer-coupon operator: $OFFER_COUPON_OPERATOR_NAME" >&2
    echo "POST $OPERATORS_BASE_URL" >&2
    echo "$request_body" | jq . >&2
    echo "" >&2

    response="$(twilio_json POST "$OPERATORS_BASE_URL" "$request_body")"
    echo "$response" | jq . >&2
    echo "" >&2

    operator_id="$(echo "$response" | extract_resource_id)"
    if [ -z "$operator_id" ]; then
        echo "Could not find operator ID in offer-coupon operator response." >&2
        echo "$response" >&2
        exit 1
    fi

    echo "$operator_id"
}

create_intent_recognition_operator() {
    local request_body
    local response
    local operator_id

    request_body=$(cat <<EOF
{
  "displayName": "$INTENT_RECOGNITION_OPERATOR_NAME",
  "description": "Returns a short description of the customer's current intent.",
  "prompt": "Identify the customer's current intent and return a short description. Examples: Change seats, Human escalation, Add check-in baggage, Flight change, Loyalty recovery.",
  "outputFormat": "JSON",
  "outputSchema": {
    "type": "object",
    "properties": {
      "description": {
        "type": "string",
        "description": "A short description of the customer's intent."
      }
    },
    "required": ["description"],
    "additionalProperties": false
  }
}
EOF
)

    echo "Creating custom intent-recognition operator: $INTENT_RECOGNITION_OPERATOR_NAME" >&2
    echo "POST $OPERATORS_BASE_URL" >&2
    echo "$request_body" | jq . >&2
    echo "" >&2

    response="$(twilio_json POST "$OPERATORS_BASE_URL" "$request_body")"
    echo "$response" | jq . >&2
    echo "" >&2

    operator_id="$(echo "$response" | extract_resource_id)"
    if [ -z "$operator_id" ]; then
        echo "Could not find operator ID in intent-recognition operator response." >&2
        echo "$response" >&2
        exit 1
    fi

    echo "$operator_id"
}

echo "Listing Conversation Intelligence operators"
echo "GET $OPERATORS_URL"
OPERATORS_RESPONSE="$(twilio_json GET "$OPERATORS_URL")"
echo "$OPERATORS_RESPONSE" | jq -r '.items[] | "- \(.displayName) (\(.author)): \(.id)"'
echo ""

TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID="$(resolve_operator_id "Sentiment" '
  .items
  | map(select((.displayName // "" | ascii_downcase) | test("sentiment")))
  | .[0].id // empty
')"
TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID="$(resolve_operator_id "Summary" '
  .items
  | map(select((.displayName // "" | ascii_downcase) | test("summary|summarization")))
  | .[0].id // empty
')"
TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID="$(find_operator_id \
  --arg name "$INTENT_RECOGNITION_OPERATOR_NAME" '
  .items
  | map(select((.displayName // "" | ascii_downcase) == ($name | ascii_downcase)))
  | .[0].id // empty
')"
if [ -z "$TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID" ] || [ "$TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID" = "null" ]; then
    TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID="$(create_intent_recognition_operator)"
fi
TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID="$(find_operator_id \
  --arg name "$OFFER_COUPON_OPERATOR_NAME" '
  .items
  | map(select((.displayName // "" | ascii_downcase) == ($name | ascii_downcase)))
  | .[0].id // empty
')"
if [ -z "$TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID" ] || [ "$TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID" = "null" ]; then
    TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID="$(create_offer_coupon_operator)"
fi

echo "Resolved operator IDs:"
echo "TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID=$TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID=$TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID=$TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID=$TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID"
echo ""

require_env TWILIO_VOICE_PUBLIC_DOMAIN

CONVERSATION_INTELLIGENCE_WEBHOOK_URL="https://${TWILIO_VOICE_PUBLIC_DOMAIN}/ci-webhook"
ACTIONS_JSON="[{\"type\": \"WEBHOOK\", \"method\": \"POST\", \"url\": \"$CONVERSATION_INTELLIGENCE_WEBHOOK_URL\"}]"

REQUEST_BODY=$(cat <<EOF
{
  "displayName": "$DISPLAY_NAME",
  "description": "Sentiment, intent-recognition, offer-coupon and summaries",
  "rules": [
    {
      "operators": [
        {"id": "$TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID"},
        {"id": "$TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID"},
        {"id": "$TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID"}
      ],
      "triggers": [{"on": "COMMUNICATION", "parameters": {"count": 1}}],
      "actions": $ACTIONS_JSON,
      "context": {"memory": {"enabled": true}}
    },
    {
      "operators": [{"id": "$TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID"}],
      "triggers": [{"on": "CONVERSATION_END"}],
      "actions": $ACTIONS_JSON,
      "context": {"memory": {"enabled": true}}
    }
  ]
}
EOF
)

echo "Creating Intelligence Configuration: $DISPLAY_NAME"
echo "Webhook: $CONVERSATION_INTELLIGENCE_WEBHOOK_URL"
echo "POST $INTELLIGENCE_CONFIG_URL"
echo "$REQUEST_BODY" | jq .
echo ""

RESPONSE=$(twilio_json POST "$INTELLIGENCE_CONFIG_URL" "$REQUEST_BODY")
echo "$RESPONSE" | jq .
echo ""

INTELLIGENCE_CONFIG_ID=$(extract_operation_result_id "$RESPONSE" "Intelligence Configuration creation")

echo "Intelligence Configuration created:"
echo "TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID=$TWILIO_INTELLIGENCE_SENTIMENT_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID=$TWILIO_INTELLIGENCE_INTENT_RECOGNITION_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID=$TWILIO_INTELLIGENCE_OFFER_COUPON_OPERATOR_ID"
echo "TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID=$TWILIO_INTELLIGENCE_SUMMARY_OPERATOR_ID"
echo ""
echo "CONVERSATION_INTELLIGENCE_CONFIGURATION_ID=$INTELLIGENCE_CONFIG_ID"
