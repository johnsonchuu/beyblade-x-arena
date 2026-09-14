"""Regression test for the localStorage data-loss bug.

The bug: App.tsx declared the persist effect BEFORE the bootstrap effect.
Effects run in declaration order, so on mount the persist effect wrote the
empty initial state over the saved data, and the bootstrap effect then read
back that empty state. Net effect: saved tournaments were destroyed on load.

This test seeds real state and asserts it survives a reload. Against the old
code, T1 fails with players=0. Against the fixed code, all checks pass.
"""

import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:5173/")
KEY = "beyblade-x-arena-v1"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (("  | " + detail) if detail else ""))


def make_state():
    def beys(prefix):
        return [
            {"id": f"{prefix}b1", "blade": "Dran Buster", "ratchet": "1-60A", "bit": "Low Flat"},
            {"id": f"{prefix}b2", "blade": "Wizard Rod", "ratchet": "9-60B", "bit": "Ball"},
            {"id": f"{prefix}b3", "blade": "Phoenix Wing", "ratchet": "5-60P", "bit": "Flat"},
        ]

    players = [
        {"id": "p1", "name": "Riku", "deck": beys("p1")},
        {"id": "p2", "name": "Ace", "deck": beys("p2")},
    ]
    tournament = {
        "id": "t1",
        "name": "持久化測試盃",
        "format": "round-robin",
        "targetScore": 4,
        "createdAt": 1,
        "players": players,
        "matches": [],
        "activeMatchId": None,
    }
    return {"players": players, "tournaments": [tournament], "activeTournamentId": "t1"}


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()

    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ---- T1: seeded state must survive a hard reload -------------------------
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("([k, v]) => localStorage.setItem(k, v)", [KEY, json.dumps(make_state())])
    page.reload(wait_until="networkidle")
    time.sleep(1.5)

    raw = page.evaluate("(k) => localStorage.getItem(k)", KEY)
    got = json.loads(raw) if raw else {}
    check(
        "T1 saved players survive reload",
        len(got.get("players", [])) == 2,
        f"players={len(got.get('players', []))}",
    )
    check(
        "T1 saved tournament survives reload",
        len(got.get("tournaments", [])) == 1,
        f"tournaments={len(got.get('tournaments', []))}",
    )
    check(
        "T1 activeTournamentId preserved",
        got.get("activeTournamentId") == "t1",
        f"active={got.get('activeTournamentId')!r}",
    )

    # Screen state is intentionally not persisted, so reach the dashboard
    # through the nav to confirm the restored data actually renders.
    page.locator("nav button", has_text="賽事").first.click()
    time.sleep(0.8)
    body = page.inner_text("body")
    check("T1 UI renders restored tournament", "持久化測試盃" in body)
    check("T1 UI renders restored blader", "Riku" in body)

    # ---- T2: a UI-driven flow must also persist ------------------------------
    page.evaluate("(k) => localStorage.removeItem(k)", KEY)
    page.reload(wait_until="networkidle")
    time.sleep(1.0)

    for name in ("BladerOne", "BladerTwo"):
        page.fill("input[placeholder*='選手名稱']", name)
        page.locator("button", has_text="加入選手").click()
        time.sleep(0.4)

    page.locator("button", has_text="開始賽事").click()
    time.sleep(0.8)
    page.reload(wait_until="networkidle")
    time.sleep(1.5)

    raw2 = page.evaluate("(k) => localStorage.getItem(k)", KEY)
    got2 = json.loads(raw2) if raw2 else {}
    check(
        "T2 UI-created players persist",
        len(got2.get("players", [])) == 2,
        f"players={len(got2.get('players', []))}",
    )
    check(
        "T2 UI-created tournament persists",
        len(got2.get("tournaments", [])) == 1,
        f"tournaments={len(got2.get('tournaments', []))}",
    )

    check("T3 no console or page errors during boot", not errors, "; ".join(errors[:3]))

    browser.close()

failed = [r for r in results if not r[1]]
print()
print("ALL PASS" if not failed else f"{len(failed)} CHECK(S) FAILED")
sys.exit(1 if failed else 0)
