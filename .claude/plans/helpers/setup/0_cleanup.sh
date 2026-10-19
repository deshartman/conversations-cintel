#!/usr/bin/env bash
set -e

# Delete Owl Airlines Twilio Conversation Services setup.
# Usage:
#   ./helpers/setup/0_cleanup.sh                           # dry-run everything from .env
#   ./helpers/setup/0_cleanup.sh --yes                     # delete everything from .env
#   ./helpers/setup/0_cleanup.sh memory <MEMORY_STORE_ID>  # dry-run one Memory Store
#   ./helpers/setup/0_cleanup.sh --yes memory <MEMORY_STORE_ID>
#   ./helpers/setup/0_cleanup.sh conversation <CONVERSATION_CONFIG_ID>
#   ./helpers/setup/0_cleanup.sh intelligence <INTELLIGENCE_CONFIG_ID>
#   ./helpers/setup/0_cleanup.sh studio <TWILIO_STUDIO_HANDOFF_FLOW_SID>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../common.sh"

load_env

DRY_RUN=true
if [ "${1:-}" = "--yes" ]; then
    DRY_RUN=false
    shift
fi

SERVICE="${1:-all}"
ID="${2:-}"

MEMORY_STORE_ID="${ID:-${TWILIO_MEMORY_STORE_ID:-}}"
CONVERSATION_CONFIG_ID="${ID:-${TWILIO_CONVERSATION_CONFIGURATION_ID:-}}"
INTELLIGENCE_CONFIG_ID="${ID:-${CONVERSATION_INTELLIGENCE_CONFIGURATION_ID:-}}"
STUDIO_HANDOFF_FLOW_SID="${ID:-${TWILIO_STUDIO_HANDOFF_FLOW_SID:-}}"

MEMORY_STORE_URL="https://memory.twilio.com/v1/ControlPlane/Stores/$MEMORY_STORE_ID"
CONVERSATION_CONFIG_URL="https://conversations.twilio.com/v2/ControlPlane/Configurations/$CONVERSATION_CONFIG_ID"
INTELLIGENCE_CONFIG_URL="https://intelligence.twilio.com/v3/ControlPlane/Configurations/$INTELLIGENCE_CONFIG_ID"
STUDIO_HANDOFF_FLOW_URL="https://studio.twilio.com/v2/Flows/$STUDIO_HANDOFF_FLOW_SID"

if [ "$DRY_RUN" = false ]; then
    require_twilio_auth
else
    echo "Dry run. No Twilio resources will be deleted."
    echo "Add --yes to apply deletion."
    echo ""
fi

delete_resource() {
    LABEL="$1"
    RESOURCE_ID="$2"
    URL="$3"

    if [ -z "$RESOURCE_ID" ]; then
        echo "Skipping $LABEL: no ID configured."
        echo ""
        return
    fi

    echo "Deleting $LABEL..."
    echo "DELETE $URL"

    if [ "$DRY_RUN" = false ]; then
        twilio_json DELETE "$URL"
    fi

    echo ""
}

case "$SERVICE" in
    all)
        delete_resource \
            "Studio handoff Flow" \
            "$STUDIO_HANDOFF_FLOW_SID" \
            "$STUDIO_HANDOFF_FLOW_URL"

        delete_resource \
            "Conversation Configuration" \
            "$CONVERSATION_CONFIG_ID" \
            "$CONVERSATION_CONFIG_URL"

        delete_resource \
            "Intelligence Configuration" \
            "$INTELLIGENCE_CONFIG_ID" \
            "$INTELLIGENCE_CONFIG_URL"

        delete_resource \
            "Memory Store" \
            "$MEMORY_STORE_ID" \
            "$MEMORY_STORE_URL"
        ;;

    memory)
        MEMORY_STORE_ID="${ID:-${TWILIO_MEMORY_STORE_ID:-}}"
        MEMORY_STORE_URL="https://memory.twilio.com/v1/ControlPlane/Stores/$MEMORY_STORE_ID"
        delete_resource "Memory Store" "$MEMORY_STORE_ID" "$MEMORY_STORE_URL"
        ;;

    conversation)
        CONVERSATION_CONFIG_ID="${ID:-${TWILIO_CONVERSATION_CONFIGURATION_ID:-}}"
        CONVERSATION_CONFIG_URL="https://conversations.twilio.com/v2/ControlPlane/Configurations/$CONVERSATION_CONFIG_ID"
        delete_resource \
            "Conversation Configuration" \
            "$CONVERSATION_CONFIG_ID" \
            "$CONVERSATION_CONFIG_URL"
        ;;

    intelligence)
        INTELLIGENCE_CONFIG_ID="${ID:-${CONVERSATION_INTELLIGENCE_CONFIGURATION_ID:-}}"
        INTELLIGENCE_CONFIG_URL="https://intelligence.twilio.com/v3/ControlPlane/Configurations/$INTELLIGENCE_CONFIG_ID"
        delete_resource \
            "Intelligence Configuration" \
            "$INTELLIGENCE_CONFIG_ID" \
            "$INTELLIGENCE_CONFIG_URL"
        ;;

    studio)
        STUDIO_HANDOFF_FLOW_SID="${ID:-${TWILIO_STUDIO_HANDOFF_FLOW_SID:-}}"
        STUDIO_HANDOFF_FLOW_URL="https://studio.twilio.com/v2/Flows/$STUDIO_HANDOFF_FLOW_SID"
        delete_resource \
            "Studio handoff Flow" \
            "$STUDIO_HANDOFF_FLOW_SID" \
            "$STUDIO_HANDOFF_FLOW_URL"
        ;;

    *)
        echo "Unknown cleanup target: $SERVICE"
        echo ""
        echo "Use one of:"
        echo "  all"
        echo "  memory <MEMORY_STORE_ID>"
        echo "  conversation <CONVERSATION_CONFIG_ID>"
        echo "  intelligence <INTELLIGENCE_CONFIG_ID>"
        echo "  studio <TWILIO_STUDIO_HANDOFF_FLOW_SID>"
        exit 1
        ;;
esac

echo "Done."
