#!/usr/bin/env python3
"""
Leak-free Cloudflare credential diagnostic.

Prints only lengths, booleans, and masked identifiers - never the raw
account ID or token - because this repository is public and Actions logs
are world-readable.

Exit code is always 0; this is a diagnostic, not a gate.
"""
import json
import os
import sys
import urllib.request

account = os.environ.get("CF_ACCOUNT", "")
token = os.environ.get("CF_TOKEN", "")

print(f"raw secret length      : {len(account)}")
print(f"token length           : {len(token)}")
print(f"has surrounding space  : {'YES  <-- copy-paste newline/space' if account != account.strip() else 'no'}")
print(f"has inner whitespace   : {'YES  <-- malformed' if any(c.isspace() for c in account.strip()) else 'no'}")

stripped = account.strip()

# Shape checks. Cloudflare account IDs are exactly 32 hex chars; API tokens
# are 40 chars. Length alone catches the most common copy-paste mistakes
# (Account ID pasted into the token secret, or a Zone ID / dashboard URL
# pasted into the account secret).
ok_account_shape = len(stripped) == 32 and all(c in "0123456789abcdef" for c in stripped.lower())
ok_token_shape = len(token) == 40
print(f"account id shape ok    : {ok_account_shape}  (expected 32 hex chars, got {len(stripped)})")
print(f"api token shape ok     : {ok_token_shape}  (expected 40 chars, got {len(token)})")

if not ok_token_shape and len(token) == 32:
    print("  -> CLOUDFLARE_API_TOKEN looks like an ACCOUNT ID (32 hex chars), not an API token.")
    print("  -> Create a token: Cloudflare dashboard > My Profile > API Tokens > Create Token")
    print("     ('Edit Cloudflare Workers' template includes the Pages permissions needed).")
elif not ok_token_shape:
    print("  -> CLOUDFLARE_API_TOKEN is not the expected 40-char length; re-copy it from the API Tokens page.")

if not ok_account_shape:
    print("  -> CLOUDFLARE_ACCOUNT_ID is not a 32-hex-char account ID.")
    print("  -> Copy it from the Cloudflare dashboard sidebar ('Account ID'), not a Zone ID or a URL.")

if not (ok_account_shape and ok_token_shape):
    print()
    print("Stopping here: the credential shapes are wrong, so the API call below cannot succeed.")
    sys.exit(0)

req = urllib.request.Request(
    "https://api.cloudflare.com/client/v4/accounts",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)
except Exception as exc:  # noqa: BLE001 - diagnostic only
    print(f"accounts query failed  : {exc}")
    sys.exit(0)

ids = [a.get("id", "") for a in (payload.get("result") or [])]

print(f"api success            : {payload.get('success')}")
print(f"api errors             : {payload.get('errors')}")
print(f"accounts visible       : {len(ids)}")

def mask(value: str) -> str:
    return f"{value[:6]}...{value[-4:]} (len {len(value)})" if len(value) > 10 else f"(short: len {len(value)})"

for i, acct in enumerate(ids, 1):
    print(f"  account {i}            : {mask(acct)}")

print(f"secret == visible acct : {stripped in ids}")
if ids and stripped not in ids:
    print("  -> CLOUDFLARE_ACCOUNT_ID does not match any account this token can see.")
    print("  -> Re-copy it from the Cloudflare dashboard sidebar (Account ID), not a Zone ID.")
elif not ids:
    print("  -> Token cannot list any account; it may be scoped to a different account or lack Account:Read.")
