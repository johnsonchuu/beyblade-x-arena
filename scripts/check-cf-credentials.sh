#!/usr/bin/env bash
# Check the shape of Cloudflare credential values on your clipboard.
#
# Runs entirely locally - the value is never written to a file, never sent
# anywhere, and never printed in full. Use it to verify a value BEFORE
# running `gh secret set`, so a bad pasted value never reaches GitHub.
#
# Usage:
#   ./scripts/check-cf-credentials.sh account   # check for a 32-char hex account ID
#   ./scripts/check-cf-credentials.sh token     # check for a 40-char API token
#
# macOS only (uses pbpaste). On Linux, pipe the value in on stdin instead.

set -uo pipefail

KIND="${1:-}"
if [[ "$KIND" != "account" && "$KIND" != "token" ]]; then
  echo "usage: $0 <account|token>" >&2
  exit 2
fi

# Prefer piped stdin (so the script is testable and scriptable); fall back to
# the macOS clipboard only when nothing is piped in.
if [[ ! -t 0 ]]; then
  VALUE="$(cat)"
  SOURCE="stdin"
elif command -v pbpaste >/dev/null 2>&1; then
  VALUE="$(pbpaste)"
  SOURCE="clipboard"
else
  echo "nothing piped in and pbpaste unavailable; pipe the value on stdin" >&2
  exit 2
fi

LEN=${#VALUE}
echo "source        : $SOURCE"
echo "length        : $LEN"

# Show only a masked preview so the secret never lands in scrollback.
if (( LEN > 10 )); then
  echo "preview       : ${VALUE:0:4}...${VALUE: -2}"
else
  echo "preview       : (too short to preview)"
fi

# Detect a trailing newline or stray whitespace - the classic copy-paste bug.
TRIMMED="$(printf '%s' "$VALUE" | tr -d '[:space:]')"
if [[ "$TRIMMED" != "$VALUE" ]]; then
  echo "whitespace    : PRESENT  <-- strip it, or use 'printf %s' piped to gh"
else
  echo "whitespace    : none"
fi

# Detect a KEY=VALUE paste, which is very common when copying out of a .env
# file or a password manager.
if [[ "$VALUE" == *=* ]]; then
  echo "looks like    : a KEY=VALUE line  <-- copy only the part AFTER the '='"
fi

# Detect the wrong credential entirely: a 32-hex string handed in as a token
# means an account ID was copied into the token secret.
if (( LEN == 32 )) && [[ "$TRIMMED" =~ ^[0-9a-fA-F]{32}$ ]]; then
  echo "shape         : 32 hex chars = an ACCOUNT ID"
  if [[ "$KIND" == "token" ]]; then
    echo ""
    echo "WRONG SECRET: this is an account ID, not an API token."
    echo "  An API token comes from My Profile > API Tokens > Create Token"
    exit 1
  fi
  echo ""
  echo "OK: this is a valid account ID."
  exit 0
fi

if [[ "$KIND" == "account" ]]; then
  echo ""
  echo "WRONG VALUE for CLOUDFLARE_ACCOUNT_ID."
  echo "  Expected exactly 32 hex characters, got $LEN."
  echo "  Get it from: Workers & Pages > Overview > right sidebar 'Account ID'."
  exit 1
fi

if (( LEN == 40 )); then
  echo ""
  echo "OK: 40 chars looks like a valid API token."
  exit 0
fi

echo ""
echo "SUSPECT for CLOUDFLARE_API_TOKEN."
echo "  Cloudflare API tokens are normally 40 characters, got $LEN."
echo "  If your token really is this length it may still be valid - try it,"
echo "  but re-copy from the API Tokens page if the deploy fails with 400/403."
exit 1
