#!/usr/bin/env bash
set -e

# Create trait groups for the Owl Airlines demo passenger profile.
# Usage: ./helpers/profile/1_create_trait_groups.sh
# Usage: ./helpers/profile/1_create_trait_groups.sh <TWILIO_MEMORY_STORE_ID>

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

TRAIT_GROUPS_URL="https://memory.twilio.com/v1/ControlPlane/Stores/$TWILIO_MEMORY_STORE_ID/TraitGroups"

create_trait_group() {
    local name="$1"
    local body="$2"

    echo "Creating Trait Group: $name"
    echo "POST $TRAIT_GROUPS_URL"
    echo "$body" | jq .
    echo ""

    RESPONSE=$(twilio_json POST "$TRAIT_GROUPS_URL" "$body")
    echo "$RESPONSE" | jq .
    echo ""

    STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl // empty')
    if [ -n "$STATUS_URL" ]; then
        echo "Waiting for Trait Group to finish registering..."
        wait_for_operation "$STATUS_URL" "$name Trait Group creation" >/dev/null
        echo ""
    fi
}

CONTACT_BODY=$(cat <<EOF
{
  "displayName": "Contact",
  "traits": {
    "firstName": {"dataType": "STRING", "description": "Passenger first name"},
    "lastName": {"dataType": "STRING", "description": "Passenger last name"},
    "phone": {"dataType": "STRING", "description": "Passenger phone number"},
    "email": {"dataType": "STRING", "description": "Passenger email address"}
  }
}
EOF
)

LOYALTY_BODY=$(cat <<EOF
{
  "displayName": "Loyalty",
  "traits": {
    "memberNumber": {"dataType": "STRING", "description": "Owl Club member number"},
    "tier": {"dataType": "STRING", "description": "Owl Club loyalty tier"},
    "milesBalance": {"dataType": "NUMBER", "description": "Current loyalty miles balance"}
  }
}
EOF
)

TRAVEL_BODY=$(cat <<EOF
{
  "displayName": "Travel",
  "traits": {
    "seatPreference": {"dataType": "STRING", "description": "Preferred aircraft seat type"},
    "mealPreference": {"dataType": "STRING", "description": "Preferred in-flight meal"},
    "accessibilityNeeds": {"dataType": "STRING", "description": "Accessibility or assistance needs"}
  }
}
EOF
)

# create_trait_group "Contact" "$CONTACT_BODY"
create_trait_group "Loyalty" "$LOYALTY_BODY"
create_trait_group "Travel" "$TRAVEL_BODY"

echo "Trait groups created for:"
echo "TWILIO_MEMORY_STORE_ID=$TWILIO_MEMORY_STORE_ID"
