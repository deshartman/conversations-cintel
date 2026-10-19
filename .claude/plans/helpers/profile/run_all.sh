#!/usr/bin/env bash
set -euo pipefail

# Create the Owl Airlines demo passenger memory profile.
# Usage: ./helpers/profile/run_all.sh
# Usage: ./helpers/profile/run_all.sh <TWILIO_MEMORY_STORE_ID>

PROFILE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$PROFILE_SCRIPT_DIR/../common.sh"

load_env

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

MEMORY_STORE_ID="${1:-${TWILIO_MEMORY_STORE_ID:-}}"

echo "===================================="
echo "Owl Airlines Passenger Memory Setup"
echo "===================================="
echo ""

echo "Step 1: Create trait groups"
TRAIT_OUTPUT="$("$PROFILE_SCRIPT_DIR/1_create_trait_groups.sh" "$MEMORY_STORE_ID")"
echo "$TRAIT_OUTPUT"
echo ""

echo "Step 2: Create passenger profile"
PROFILE_OUTPUT="$("$PROFILE_SCRIPT_DIR/2_create_profile.sh" "$MEMORY_STORE_ID")"
echo "$PROFILE_OUTPUT"
PROFILE_ID="$(echo "$PROFILE_OUTPUT" | extract_env_value "TWILIO_MEMORY_PROFILE_ID")"
require_output_value TWILIO_MEMORY_PROFILE_ID "$PROFILE_ID"
echo ""

echo "Step 3: Add observations"
OBSERVATION_OUTPUT="$("$PROFILE_SCRIPT_DIR/3_add_observations.sh" "$MEMORY_STORE_ID" "$PROFILE_ID")"
echo "$OBSERVATION_OUTPUT"
echo ""

echo "Step 4: Verify memory recall"
echo "Memory observations are processed asynchronously, so this step may wait briefly."
VERIFY_OUTPUT="$("$PROFILE_SCRIPT_DIR/4_verify_memory.sh" "$MEMORY_STORE_ID" "$PROFILE_ID")"
echo "$VERIFY_OUTPUT"
echo ""

echo "===================================="
echo "Profile setup complete"
echo "===================================="
echo ""
echo "Add this value to .env:"
echo "TWILIO_MEMORY_PROFILE_ID=$PROFILE_ID"
