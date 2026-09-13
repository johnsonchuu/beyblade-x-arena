#!/usr/bin/env python3
"""
Cloudflare credential diagnostic - reports what the API actually says.

Deliberately does NOT gate on credential shape. Length/shape is a heuristic;
the API response is ground truth. Shape mismatches are reported as warnings so
we still reach the real call and see the real error.

Never prints the raw account ID or token - this repo is public and Actions
logs are world-readable. Identifiers are masked to first 6 / last 4.
"""
import json
import os
import sys
import urllib.error
import urllib.request

account = os.environ.get("CF_ACCOUNT", "").strip()
token = os.environ.get("CF_TOKEN", "").strip()

print("=== credential shape (warnings only) ===")
print(f"account length         : {len(account)}")
print(f"token length           : {len(token)}")
print(f"account whitespace     : {'PRESENT - strip it' if account != os.environ.get('CF_ACCOUNT', '') else 'none'}")
print(f"token whitespace       : {'PRESENT - strip it' if token != os.environ.get('CF_TOKEN', '') else 'none'}")

if len(account) != 32:
    print(f"WARN account id is {len(account)} chars; a Cloudflare account ID is normally 32 hex chars.")
if len(token) != 40:
    print(f"WARN token is {len(token)} chars; Cloudflare API tokens are usually ~40 chars.")
print("(warnings only - continuing to the live API call below)")

print()
print("=== live API: GET /accounts ===")
req = urllib.request.Request(
    "https://api.cloudflare.com/client/v4/accounts",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        status = resp.status
        payload = json.load(resp)
except urllib.error.HTTPError as exc:
    status = exc.code
    body = exc.read().decode("utf-8", "replace")
    print(f"HTTP status            : {status}")
    print(f"raw response body      : {body}")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = {}
except Exception as exc:  # noqa: BLE001 - diagnostic only
    print(f"request failed         : {type(exc).__name__}: {exc}")
    sys.exit(0)
else:
    print(f"HTTP status            : {status}")

print(f"api success            : {payload.get('success')}")
print(f"api errors             : {payload.get('errors')}")
print(f"api messages           : {payload.get('messages')}")

results = payload.get("result") or []
print(f"accounts returned      : {len(results)}")


def mask(value: str) -> str:
    if not value:
        return "(empty)"
    return f"{value[:6]}...{value[-4:]}" if len(value) > 10 else f"(short,len {len(value)})"


for i, acct in enumerate(results, 1):
    print(f"  account {i}            : {mask(acct.get('id', ''))}  name={acct.get('name')!r}")

if results:
    visible = [a.get("id", "") for a in results]
    if account in visible:
        print("RESULT                 : account ID matches a visible account - credentials look correct.")
    else:
        print("RESULT                 : account ID does NOT match any visible account.")
        print("                         Token is valid; the ACCOUNT_ID secret points at the wrong account.")

print()
print("=== live API: GET /accounts/<account>/pages/projects ===")
if not account:
    print("skipped                : no account id supplied")
    sys.exit(0)

req2 = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    with urllib.request.urlopen(req2, timeout=30) as resp:
        payload2 = json.load(resp)
        print(f"HTTP status            : {resp.status}")
except urllib.error.HTTPError as exc:
    print(f"HTTP status            : {exc.code}")
    body = exc.read().decode("utf-8", "replace")
    print(f"raw response body      : {body}")
    try:
        payload2 = json.loads(body)
    except json.JSONDecodeError:
        payload2 = {}
except Exception as exc:  # noqa: BLE001
    print(f"request failed         : {type(exc).__name__}: {exc}")
    sys.exit(0)

print(f"api success            : {payload2.get('success')}")
print(f"api errors             : {payload2.get('errors')}")
print(f"projects returned      : {len(payload2.get('result') or [])}")
for proj in payload2.get("result") or []:
    print(f"  project              : {proj.get('name')!r}")
