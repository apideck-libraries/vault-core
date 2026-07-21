#!/usr/bin/env bash
#
# Mint a REAL unify session token for the grant-handoff harness and write it into
# example/.env as VITE_VAULT_TOKEN (leaving other vars intact).
#
# The token carries a TOP-LEVEL `redirect_uri` claim of
# http://localhost:1234/oauth/callback, so <Vault>'s deriveLaunchUrl opens our
# local /oauth/launch stand-in. (unify accepts top-level redirect_uri; a
# settings.redirect_uri 400s — do not use that.)
#
# Usage:
#   UNIFY_ADMIN_API_KEY=sk_... ./grant-handoff/mint-session.sh
#   ./grant-handoff/mint-session.sh --key sk_...
#
# Options:
#   --key <key>        unify admin API key (else read from $UNIFY_ADMIN_API_KEY)
#   --unify <url>      unify base URL (default https://localhost:3050)
#   --redirect <url>   redirect_uri (default http://localhost:1234/oauth/callback)
#   --app <id>         X-APIDECK-APP-ID (default 2222)
#   --consumer <id>    X-APIDECK-CONSUMER-ID (default test-consumer)
#
# Notes:
#   - unify runs with a self-signed cert; curl uses -k. Visit https://localhost:3050
#     once in the browser first to accept the cert for the in-browser fetches.
#   - Tokens are ~1h TTL — re-run this when the widget stops loading connections.
#   - NEVER hardcode a key in this file or commit one; .env is gitignored.

set -euo pipefail

KEY="${UNIFY_ADMIN_API_KEY:-}"
UNIFY="https://localhost:3050"
REDIRECT="http://localhost:1234/oauth/callback"
APP_ID="2222"
CONSUMER_ID="test-consumer"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) KEY="$2"; shift 2 ;;
    --unify) UNIFY="$2"; shift 2 ;;
    --redirect) REDIRECT="$2"; shift 2 ;;
    --app) APP_ID="$2"; shift 2 ;;
    --consumer) CONSUMER_ID="$2"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$KEY" ]]; then
  echo "error: no unify admin API key. Set \$UNIFY_ADMIN_API_KEY or pass --key <key>." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.env"

echo "Minting session against $UNIFY (redirect_uri=$REDIRECT, app=$APP_ID, consumer=$CONSUMER_ID)…" >&2

RESPONSE="$(curl -sk -X POST "$UNIFY/vault/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -H "X-APIDECK-CONSUMER-ID: $CONSUMER_ID" \
  -H "X-APIDECK-APP-ID: $APP_ID" \
  -d "{\"redirect_uri\":\"$REDIRECT\",\"consumer_metadata\":{\"account_name\":\"Sample\"}}")"

# Extract data.session_token without requiring jq.
extract_token() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq -r '.data.session_token // empty'
  else
    printf '%s' "$1" | sed -n 's/.*"session_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
  fi
}

TOKEN="$(extract_token "$RESPONSE")"

if [[ -z "$TOKEN" ]]; then
  echo "error: no session_token in unify response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# Decode the JWT payload (2nd segment, base64url) and print the exp for sanity.
decode_exp() {
  local payload="${TOKEN#*.}"; payload="${payload%%.*}"
  # base64url -> base64, pad to a multiple of 4.
  payload="${payload//-/+}"; payload="${payload//_//}"
  while [[ $(( ${#payload} % 4 )) -ne 0 ]]; do payload="${payload}="; done
  local json
  json="$(printf '%s' "$payload" | base64 -d 2>/dev/null || true)"
  local exp
  if command -v jq >/dev/null 2>&1; then
    exp="$(printf '%s' "$json" | jq -r '.exp // empty')"
  else
    exp="$(printf '%s' "$json" | sed -n 's/.*"exp"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p')"
  fi
  if [[ -n "$exp" ]]; then
    local human
    human="$(date -r "$exp" 2>/dev/null || date -d "@$exp" 2>/dev/null || echo "$exp")"
    echo "token exp: $exp ($human)" >&2
  fi
}
decode_exp

# Write/update VITE_VAULT_TOKEN in example/.env, leaving other vars intact.
touch "$ENV_FILE"
if grep -q '^VITE_VAULT_TOKEN=' "$ENV_FILE"; then
  tmp="$(mktemp)"
  # Use a non-/ delimiter — JWTs contain no '|'.
  sed "s|^VITE_VAULT_TOKEN=.*|VITE_VAULT_TOKEN=$TOKEN|" "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
else
  printf 'VITE_VAULT_TOKEN=%s\n' "$TOKEN" >> "$ENV_FILE"
fi

echo "Wrote VITE_VAULT_TOKEN to $ENV_FILE. Restart 'yarn start' to pick it up." >&2
