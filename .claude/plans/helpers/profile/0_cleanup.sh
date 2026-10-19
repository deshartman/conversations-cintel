#!/usr/bin/env bash
set -e

# Delete the demo passenger profile and optional Owl Airlines trait groups.
# Usage:
#   ./helpers/profile/0_cleanup.sh                                      # dry-run all from .env
#   ./helpers/profile/0_cleanup.sh --yes                                # delete all from .env
#   ./helpers/profile/0_cleanup.sh profile <TWILIO_MEMORY_PROFILE_ID>
#   ./helpers/profile/0_cleanup.sh --yes profile <TWILIO_MEMORY_PROFILE_ID>
#   ./helpers/profile/0_cleanup.sh --yes profile <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
#   ./helpers/profile/0_cleanup.sh traits <TWILIO_MEMORY_STORE_ID>
#   ./helpers/profile/0_cleanup.sh --yes traits <TWILIO_MEMORY_STORE_ID>
#   ./helpers/profile/0_cleanup.sh --yes all <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env
require_command jq

DRY_RUN=true
if [ "${1:-}" = "--yes" ]; then
    DRY_RUN=false
    shift
fi

TARGET="${1:-all}"

case "$TARGET" in
    all)
        if [ -n "${2:-}" ]; then
            TWILIO_MEMORY_STORE_ID="$2"
        fi
        if [ -n "${3:-}" ]; then
            TWILIO_MEMORY_PROFILE_ID="$3"
        fi
        ;;
    profile)
        if [ -n "${3:-}" ]; then
            TWILIO_MEMORY_STORE_ID="$2"
            TWILIO_MEMORY_PROFILE_ID="$3"
        elif [ -n "${2:-}" ]; then
            TWILIO_MEMORY_PROFILE_ID="$2"
        fi
        ;;
    traits)
        if [ -n "${2:-}" ]; then
            TWILIO_MEMORY_STORE_ID="$2"
        fi
        ;;
    *)
        if [ -n "${2:-}" ]; then
            TWILIO_MEMORY_STORE_ID="$1"
            TWILIO_MEMORY_PROFILE_ID="$2"
            TARGET="all"
        elif [ -n "${1:-}" ]; then
            TWILIO_MEMORY_PROFILE_ID="$1"
            TARGET="all"
        else
            echo "Unknown cleanup target: $TARGET"
            exit 1
        fi
        ;;
esac

if [ "$DRY_RUN" = true ]; then
    echo "Dry run. No Twilio profile resources will be deleted."
    echo "Add --yes to apply deletion."
    echo ""
else
    require_twilio_auth
fi

delete_profile() {
    if [ -z "${TWILIO_MEMORY_PROFILE_ID:-}" ]; then
        echo "Skipping Passenger Profile: no TWILIO_MEMORY_PROFILE_ID configured."
        echo ""
        return
    fi

    require_env TWILIO_MEMORY_STORE_ID

    local profile_url="https://memory.twilio.com/v1/Stores/$TWILIO_MEMORY_STORE_ID/Profiles/$TWILIO_MEMORY_PROFILE_ID"

    echo "Deleting Passenger Profile..."
    echo "DELETE $profile_url"
    if [ "$DRY_RUN" = false ]; then
        twilio_json DELETE "$profile_url" | jq .
    fi
    echo ""
}

delete_trait_group() {
    local name="$1"
    local trait_group_id=""

    echo "Finding Trait Group: $name"
    echo "GET $TRAIT_GROUPS_URL"

    if [ "$DRY_RUN" = false ]; then
        TRAIT_GROUPS_RESPONSE=$(twilio_json GET "$TRAIT_GROUPS_URL")
        trait_group_id=$(echo "$TRAIT_GROUPS_RESPONSE" | jq -r --arg name "$name" '
            [
              .. | objects
              | select(.displayName? == $name or .name? == $name)
              | .id? // .sid? // .uniqueName? // empty
            ]
            | .[0] // empty
        ')
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "DELETE $TRAIT_GROUPS_URL/<$name trait group id>"
        echo ""
        return
    fi

    if [ -n "$trait_group_id" ]; then
        echo "Deleting Trait Group: $name"
        echo "DELETE $TRAIT_GROUPS_URL/$trait_group_id"
        twilio_json DELETE "$TRAIT_GROUPS_URL/$trait_group_id" | jq .
        echo ""
        return
    fi

    echo "Deleting Trait Group by display name: $name"
    echo "DELETE $TRAIT_GROUPS_URL/$name"
    twilio_json DELETE "$TRAIT_GROUPS_URL/$name" | jq .
    echo ""
}

delete_trait_groups() {
    require_env TWILIO_MEMORY_STORE_ID

    TRAIT_GROUPS_URL="https://memory.twilio.com/v1/ControlPlane/Stores/$TWILIO_MEMORY_STORE_ID/TraitGroups"
    TRAIT_GROUPS="${TWILIO_MEMORY_PROFILE_TRAIT_GROUPS:-Loyalty,Travel}"

    for GROUP in ${TRAIT_GROUPS//,/ }; do
        delete_trait_group "$GROUP"
    done
}

case "$TARGET" in
    all)
        delete_profile
        delete_trait_groups
        ;;
    profile)
        delete_profile
        ;;
    traits)
        delete_trait_groups
        ;;
esac

echo "Done."
