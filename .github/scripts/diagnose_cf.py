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
