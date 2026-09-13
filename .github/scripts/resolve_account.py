#!/usr/bin/env python3
"""
Resolve the Cloudflare account ID from the API token and export it for
subsequent steps.

Why this exists: the account ID secret is a second, independently-wrong-able
value, and when it is wrong every Pages call fails with an opaque
404 / code 7003 ("could not route to /accounts/***/pages/projects") even
though the token itself is perfectly valid. The token can already enumerate
the accounts it can reach, so the account ID is derivable rather than
something that has to be kept correct by hand.

Behaviour:
  1. If CLOUDFLARE_ACCOUNT_ID is set and matches a visible account, keep it.
     An explicitly configured value wins - this only fills in the gap.
  2. Otherwise, if the token can see exactly one account, use it.
  3. Otherwise, fail loudly rather than guessing between accounts.

Writes CF_ACCOUNT_RESOLVED to $GITHUB_ENV. Prints only masked identifiers,
since this repository is public and Actions logs are world-readable.
"""
import json
import os
import sys
import urllib.error
import urllib.request

token = os.environ.get("CF_TOKEN", "").strip()
configured = os.environ.get("CF_ACCOUNT_SECRET", "").strip()


def mask(value: str) -> str:
    if not value:
        return "(empty)"
    return f"{value[:6]}...{value[-4:]}" if len(value) > 10 else f"(short,len {len(value)})"


def emit(account_id: str, reason: str) -> None:
    print(f"resolved account       : {mask(account_id)}")
    print(f"reason                 : {reason}")
    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        with open(github_env, "a", encoding="utf-8") as handle:
            handle.write(f"CF_ACCOUNT_RESOLVED={account_id}\n")
    else:
        print("(no GITHUB_ENV; not exporting)")


req = urllib.request.Request(
    "https://api.cloudflare.com/client/v4/accounts",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", "replace")
    print(f"accounts query failed  : HTTP {exc.code}")
    print(f"raw response body      : {body}")
    sys.exit(1)
except Exception as exc:  # noqa: BLE001
    print(f"accounts query failed  : {type(exc).__name__}: {exc}")
    sys.exit(1)

if not payload.get("success"):
    print(f"token rejected         : {payload.get('errors')}")
    sys.exit(1)

accounts = payload.get("result") or []
print(f"accounts visible       : {len(accounts)}")
for i, acct in enumerate(accounts, 1):
    print(f"  account {i}            : {mask(acct.get('id', ''))}  name={acct.get('name')!r}")

ids = [a.get("id", "") for a in accounts if a.get("id")]

if configured and configured in ids:
    emit(configured, "configured CLOUDFLARE_ACCOUNT_ID is valid")
    sys.exit(0)

if configured:
    print(f"WARN configured account: {mask(configured)} is NOT among the accounts this token can see.")
    print("     Falling back to a derived account ID.")

if len(ids) == 1:
    emit(ids[0], "token can see exactly one account")
    sys.exit(0)

if not ids:
    print("FAIL: token cannot see any account. It may lack the Pages/Account permission.")
    sys.exit(1)

print(f"FAIL: token can see {len(ids)} accounts, so the intended one is ambiguous.")
print("      Set CLOUDFLARE_ACCOUNT_ID to the 32-char ID from the dashboard sidebar")
print("      (Workers & Pages > Overview > right sidebar 'Account ID').")
sys.exit(1)
