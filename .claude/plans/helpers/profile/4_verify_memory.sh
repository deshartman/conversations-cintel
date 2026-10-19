#!/usr/bin/env bash
set -e

# Verify the demo passenger memory can be recalled.
# Usage: ./helpers/profile/4_verify_memory.sh
# Usage: ./helpers/profile/4_verify_memory.sh <TWILIO_MEMORY_PROFILE_ID>
# Usage: ./helpers/profile/4_verify_memory.sh <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth

if [ -n "${2:-}" ]; then
    TWILIO_MEMORY_STORE_ID="$1"
    TWILIO_MEMORY_PROFILE_ID="$2"
elif [ -n "${1:-}" ]; then
    TWILIO_MEMORY_PROFILE_ID="$1"
fi

require_env TWILIO_MEMORY_STORE_ID
require_env TWILIO_MEMORY_PROFILE_ID

RECALL_URL="https://memory.twilio.com/v1/Stores/$TWILIO_MEMORY_STORE_ID/Profiles/$TWILIO_MEMORY_PROFILE_ID/Recall"

REQUEST_BODY=$(cat <<EOF
{
  "query": "Passenger seat preferences, upcoming trip, loyalty status, and rebooking needs",
  "observationsLimit": 10,
  "summariesLimit": 3
}
EOF
)

echo "Recalling Passenger Memory..."
echo "POST $RECALL_URL"
echo "$REQUEST_BODY" | jq .
echo ""

for ATTEMPT in 1 2 3 4 5; do
    RESPONSE=$(twilio_json POST "$RECALL_URL" "$REQUEST_BODY")
    OBSERVATION_COUNT=$(echo "$RESPONSE" | jq '.observations | length')

    if [ "$OBSERVATION_COUNT" -gt 0 ]; then
        echo "$RESPONSE" | jq .
        exit 0
    fi

    if [ "$ATTEMPT" = "5" ]; then
        echo "$RESPONSE" | jq .
        echo ""
        echo "No observations returned yet. Observation processing may still be catching up."
        exit 1
    fi

    echo "No observations returned yet. Waiting for Memory indexing... ($ATTEMPT/5)"
    sleep 3
done
