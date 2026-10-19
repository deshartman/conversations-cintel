#!/usr/bin/env bash
set -e

# Add demo travel observations to an Owl Airlines passenger profile.
# Usage: ./helpers/profile/3_add_observations.sh
# Usage: ./helpers/profile/3_add_observations.sh <TWILIO_MEMORY_PROFILE_ID>
# Usage: ./helpers/profile/3_add_observations.sh <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>

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

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
OBSERVATIONS_URL="https://memory.twilio.com/v1/Stores/$TWILIO_MEMORY_STORE_ID/Profiles/$TWILIO_MEMORY_PROFILE_ID/Observations"

REQUEST_BODY=$(cat <<EOF
{
  "observations": [
    {
      "content": "Avery prefers window seats near the front of the cabin and usually avoids middle seats.",
      "source": "owl-airlines-profile",
      "occurredAt": "$NOW"
    },
    {
      "content": "Upcoming trip OA 404 from London to San Francisco is scheduled for 18 August 2026 at 7:00 PM. Avery wants to change from seat 18B to a window seat if one is available.",
      "source": "owl-airlines-reservation",
      "occurredAt": "$NOW"
    },
    {
      "content": "Avery is an Owl Club Gold member and appreciates proactive rebooking help during delays.",
      "source": "owl-airlines-loyalty",
      "occurredAt": "$NOW"
    }
  ]
}
EOF
)

echo "Adding Passenger Observations..."
echo "POST $OBSERVATIONS_URL"
echo "$REQUEST_BODY" | jq .
echo ""

RESPONSE=$(twilio_json POST "$OBSERVATIONS_URL" "$REQUEST_BODY")
echo "$RESPONSE" | jq .
echo ""

echo "Observations added for:"
echo "TWILIO_MEMORY_PROFILE_ID=$TWILIO_MEMORY_PROFILE_ID"
