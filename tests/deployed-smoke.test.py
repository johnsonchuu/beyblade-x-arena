"""Smoke test against the deployed Cloudflare Pages site.

Complements tests/persistence.test.py (which runs against a local dev server).
This drives the real production bundle, to confirm the deploy serves a working
app rather than just an index.html that happens to return 200.

Note: several headings use CSS text-transform: uppercase, so inner_text
returns "SETTINGS" / "PERSISTCHECK" rather than the source casing. Assertions
below are case-insensitive for that reason - an earlier version compared with
plain `in` and produced two false failures.

Usage:
    BASE_URL=https://beyblade-x-arena.pages.dev/ python3 tests/deployed-smoke.test.py
"""

import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "https://beyblade-x-arena.pages.dev/")
KEY = "beyblade-x-arena-v1"

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + (("  | " + detail) if detail else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 420, "height": 900})

    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    resp = page.goto(BASE, wait_until="networkidle", timeout=60000)
    check("production responds 200", resp is not None and resp.status == 200,
          f"status={resp.status if resp else 'none'}")
    time.sleep(2.5)

    # Start from a clean slate so assertions cannot pass on stale local data.
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="networkidle")
    time.sleep(2.5)

    body = page.inner_text("body")
    check("React mounted", len(body.strip()) > 50, f"{len(body.strip())} chars")
    check("Chinese UI by default", "選手登記" in body)
    check("terminology 刃擊環", "刃擊環" in body)
    check("terminology 軸心", "軸心" in body)

    # Registration, with the deck left empty on purpose: decks are optional.
    page.fill("input[placeholder*='選手名稱']", "PersistCheck")
    page.locator("button", has_text="加入選手").click()
    time.sleep(1)
    check("registration works on live site", page.locator("h3", has_text="PersistCheck").count() > 0)

    raw = page.evaluate("(k) => localStorage.getItem(k)", KEY)
    state = json.loads(raw) if raw else {}
    players = state.get("players", [])
    check("player persisted to localStorage", len(players) == 1, f"players={len(players)}")
    if players:
        check("deck is optional (未設定 placeholders)",
              players[0]["deck"][0]["blade"] == "未設定",
              players[0]["deck"][0]["blade"])

    # Persistence across reload - regression guard for the data-loss fix.
    page.reload(wait_until="networkidle")
    time.sleep(3)
    raw2 = page.evaluate("(k) => localStorage.getItem(k)", KEY)
    state2 = json.loads(raw2) if raw2 else {}
    check("players survive reload", len(state2.get("players", [])) == 1,
          f"players={len(state2.get('players', []))}")
    check("player card re-renders after reload",
          page.locator("h3", has_text="PersistCheck").count() > 0)

    # Language toggle, both directions. inner_text is uppercased by CSS, so
    # compare case-insensitively.
    page.locator("nav button", has_text="設定").first.click()
    time.sleep(0.8)
    page.locator("button", has_text="English").first.click()
    time.sleep(0.8)
    en = page.inner_text("body").upper()
    check("toggles to English", "SETTINGS" in en and "RESET ALL DATA" in en)

    page.locator("button", has_text="中文").first.click()
    time.sleep(0.8)
    zh = page.inner_text("body")
    check("toggles back to Chinese", "設定" in zh and "清除所有資料" in zh)

    check("no page errors", not errors, "; ".join(errors[:2]))

    page.screenshot(path="/tmp/deployed_smoke.png", full_page=True)
    browser.close()

failed = sum(1 for ok in results if not ok)
print()
print("ALL PASS" if not failed else f"{failed} CHECK(S) FAILED")
sys.exit(1 if failed else 0)
