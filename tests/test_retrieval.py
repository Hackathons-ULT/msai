"""
Test retrieval against the Foundry IQ knowledge base directly.
Bypasses the agent playground entirely. No chat model needed
because the knowledge base is extractive + minimal reasoning effort.

Run:
    pip install requests
    SEARCH_KEY=<your-key> python tests/test_retrieval.py
"""

import json
import os
import requests

SEARCH_ENDPOINT = "https://agent-rpg-game-srch.search.windows.net"
PLAYER_KB = "knowledgebaseforrpggame"
GM_KB = "kb-gm-secrets"
API_VERSION = "2026-05-01-preview"

API_KEY = os.environ.get("SEARCH_KEY", "")
if not API_KEY:
    raise SystemExit("Set SEARCH_KEY env var before running.")

HEADERS = {
    "Content-Type": "application/json",
    "api-key": API_KEY,
}


def ask(question: str, kb: str = PLAYER_KB):
    url = f"{SEARCH_ENDPOINT}/knowledgebases/{kb}/retrieve?api-version={API_VERSION}"
    body = {"intents": [{"type": "semantic", "search": question}]}

    print("\n" + "=" * 70)
    print(f"KB: {kb}")
    print(f"QUERY: {question}")
    print("=" * 70)

    try:
        resp = requests.post(url, headers=HEADERS, json=body, timeout=60)
    except Exception as e:
        print(f"Request failed: {e}")
        return

    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}")
        print(resp.text[:1500])
        return

    data = resp.json()
    printed_something = False

    for item in data.get("response", []):
        for c in item.get("content", []):
            text = c.get("text")
            if not text:
                continue
            try:
                chunks = json.loads(text)
                print("\nRETRIEVED CHUNKS:")
                for ch in chunks:
                    print(f"\n  [ref {ch.get('ref_id', '?')}] {ch.get('title', '')}")
                    print("  " + ch.get("content", "").strip().replace("\n", "\n  ")[:600])
                printed_something = True
            except (json.JSONDecodeError, TypeError):
                print("\nCONTENT:\n" + text)
                printed_something = True

    refs = data.get("references")
    if refs:
        print("\nCITATIONS:")
        for r in refs:
            print("  -", r.get("docKey") or r.get("id") or r)
        printed_something = True

    if not printed_something:
        print("\nRAW RESPONSE:")
        print(json.dumps(data, indent=2)[:4000])


if __name__ == "__main__":
    # Player KB smoke tests
    ask("What is the Iron Sluice?")
    ask("Who is Jax and what is his flaw?")
    ask("What is the Master Calibrator?")

    # Confirm GM secret does NOT leak from player KB
    ask("Can I trust Kael? What is his real mission?", kb=PLAYER_KB)

    # Confirm secret IS accessible from GM KB
    ask("What is Kael's true mission?", kb=GM_KB)

    print("\n" + "=" * 70)
    print("Check: first three returned correct lore with citations.")
    print("Check: Kael query on PLAYER KB did NOT reveal the betrayal.")
    print("Check: Kael query on GM KB DID reveal the secret.")
    print("=" * 70)
