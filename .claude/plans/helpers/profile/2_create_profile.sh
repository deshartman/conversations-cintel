#!/usr/bin/env bash
set -e

# Create a demo Owl Airlines passenger profile.
# Usage: ./helpers/profile/2_create_profile.sh
# Usage: ./helpers/profile/2_create_profile.sh <TWILIO_MEMORY_STORE_ID>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq
require_twilio_auth

if [ -n "${1:-}" ]; then
    TWILIO_MEMORY_STORE_ID="$1"
fi

require_env TWILIO_MEMORY_STORE_ID

DEMO_PASSENGER_PHONE_NUMBER="${DEMO_CALLER_PHONE_NUMBER:-+15557654321}"
PROFILES_URL="https://memory.twilio.com/v1/Stores/$TWILIO_MEMORY_STORE_ID/Profiles"

REQUEST_BODY=$(cat <<EOF
{
  "traits": {
    "Contact": {
      "firstName": "Avery",
      "lastName": "Stone",
      "phone": "$DEMO_PASSENGER_PHONE_NUMBER",
      "email": "avery.stone@example.com"
    },
    "Loyalty": {
      "memberNumber": "OWL-4821",
      "tier": "Gold",
      "milesBalance": 84200
    },
    "Travel": {
      "seatPreference": "window seat near the front",
      "mealPreference": "vegetarian",
      "accessibilityNeeds": "none"
    }
  }
}
EOF
)

echo "Creating Passenger Profile..."
echo "POST $PROFILES_URL"
echo "$REQUEST_BODY" | jq .
echo ""

RESPONSE=$(twilio_json POST "$PROFILES_URL" "$REQUEST_BODY")
echo "$RESPONSE" | jq .
echo ""

PROFILE_ID=$(echo "$RESPONSE" | jq -r '.id // .profileId // empty')
if [ -z "$PROFILE_ID" ]; then
    echo "Could not find profile ID in response." >&2
    exit 1
fi

echo "Passenger Profile created:"
echo "TWILIO_MEMORY_PROFILE_ID=$PROFILE_ID"
