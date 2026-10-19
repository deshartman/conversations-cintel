#!/usr/bin/env bash
set -e

# Create Memory Store for Owl Airlines customer profiles.
# Usage: ./helpers/setup/1_create_memory_store.sh
# Docs: https://www.twilio.com/docs/api/memory/v1/Store#create-store

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth

# Generate a unique display name with timestamp.
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DISPLAY_NAME="${MEMORY_STORE_NAME:-OwlAir}-${TIMESTAMP}"

MEMORY_STORE_URL="https://memory.twilio.com/v1/ControlPlane/Stores"

REQUEST_BODY=$(cat <<EOF
{
  "displayName": "$DISPLAY_NAME",
  "description": "Memory store for Owl Airlines customers"
}
EOF
)

echo "Creating Memory Store: $DISPLAY_NAME"
echo "POST $MEMORY_STORE_URL"
echo "$REQUEST_BODY"
echo ""

RESPONSE=$(twilio_json POST "$MEMORY_STORE_URL" "$REQUEST_BODY")
echo "$RESPONSE"
echo ""

MEMORY_STORE_ID=$(extract_operation_result_id "$RESPONSE" "Memory Store creation")

echo ""
echo "Memory Store created:"
echo "TWILIO_MEMORY_STORE_ID=$MEMORY_STORE_ID"
