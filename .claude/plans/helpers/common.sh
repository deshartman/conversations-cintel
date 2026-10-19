#!/usr/bin/env bash

set -euo pipefail

HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HELPERS_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"

load_env() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_twilio_auth() {
  if [ -z "${TWILIO_ACCOUNT_SID:-}" ] || [ -z "${TWILIO_AUTH_TOKEN:-}" ]; then
    echo "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN." >&2
    echo "Set them in $ENV_FILE or export them before running setup." >&2
    exit 1
  fi
}

require_env() {
  local name="$1"

  if [ -z "${!name:-}" ]; then
    echo "Missing $name." >&2
    echo "Set it in $ENV_FILE or export it before running setup." >&2
    exit 1
  fi
}

twilio_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local response
  local http_status

  if [ -n "$body" ]; then
    response="$(curl -sS -w "\n%{http_code}" -X "$method" "$url" \
      -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body")"
  else
    response="$(curl -sS -w "\n%{http_code}" -X "$method" "$url" \
      -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      -H "Content-Type: application/json")"
  fi

  http_status="$(echo "$response" | tail -n 1)"
  response="$(echo "$response" | sed '$d')"

  if [ "$http_status" -lt 200 ] || [ "$http_status" -ge 300 ]; then
    echo "Twilio API request failed: HTTP $http_status" >&2
    echo "$response" >&2
    return 1
  fi

  echo "$response"
}

wait_for_operation() {
  local status_url="$1"
  local label="$2"

  for attempt in {1..30}; do
    response="$(twilio_json GET "$status_url")"
    status="$(echo "$response" | jq -r '.status // empty' | tr '[:lower:]' '[:upper:]')"

    if [ "$status" = "COMPLETED" ]; then
      echo "$response"
      return
    fi

    if [ "$status" = "FAILED" ]; then
      echo "$response" >&2
      echo "$label failed." >&2
      exit 1
    fi

    echo "  $label status: ${status:-pending} ($attempt/30)" >&2
    sleep 2
  done

  echo "$label timed out: $status_url" >&2
  exit 1
}

extract_resource_id() {
  jq -r '
    .related.configurationId //
    .result.id //
    .resource.id //
    .id //
    empty
  '
}

extract_operation_result_id() {
  local response="$1"
  local label="$2"

  resource_id="$(echo "$response" | extract_resource_id)"
  if [ -n "$resource_id" ]; then
    echo "$resource_id"
    return
  fi

  status_url="$(echo "$response" | jq -r '.statusUrl // empty')"
  if [ -z "$status_url" ]; then
    echo "Could not find resource ID or statusUrl in $label response." >&2
    echo "$response" >&2
    exit 1
  fi

  operation="$(wait_for_operation "$status_url" "$label")"
  echo "$operation" | extract_resource_id
}
