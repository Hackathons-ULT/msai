from __future__ import annotations

import json
import urllib.request
from typing import Any

from backend.game_manager import GameManager

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma4:31b-cloud"

SYSTEM_PROMPT = """You are the Game Master for a fantasy RPG called "The Lost Sigil". You narrate the story, decide what happens when the player acts, and control the AI party members.

World: The party is searching for a lost sigil in the Whispering Woods. Goblins patrol the area, ancient ruins hide secrets, and a rival adventurer is also hunting for the sigil.

Party members:
- Thorn the Warrior — brave and direct, good at combat
- Elara the Mage — scholarly, knows arcane lore, fragile
- Vex the Rogue — sneaky, perceptive, good with traps
- Luna the Healer — kind, diplomatic, keeps the party alive

Rules:
- Respond in character as a narrator. Keep responses 2-4 sentences.
- Sometimes call for dice rolls when the outcome is uncertain.
- The player is the party leader. They give orders and the party follows.
- Make the story interesting but fair. Successes are fun, failures create drama.
- Track the state: location changes, health changes, item pickups, flags.
- The player views the party as their team — they can order any member to act.

IMPORTANT: Use agent ROLE names as keys ("Warrior", "Mage", "Rogue", "Healer"), NOT character names ("Thorn", "Elara", "Vex", "Luna").

Output only ONE JSON object (no extra text, no markdown):
{
  "narration": "Your story text here...",
  "rolls": [{"actor": "Warrior", "check": "Athletics", "difficulty": 12, "modifier": 0}],
  "state_updates": {
    "location": null,
    "active_quest": null,
    "health_changes": {"Warrior": -5, "Healer": 6},
    "inventory_add": null,
    "inventory_remove": null,
    "flags_set": null
  }
}

Set fields to null if they don't change. Rolls array can be empty if no dice needed. For health_changes use agent role as key (not character name)."""


def _call_ollama(prompt: str) -> str:
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "temperature": 0.8,
        "max_tokens": 512,
    }).encode()
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            return data.get("response", "")
    except Exception as e:
        return f"[Ollama error: {e}]"


def _build_prompt(state: dict, player_action: str) -> str:
    party_lines = "\n".join(
        f"  {m['name']} the {m['agent']} (HP: {m['health']}/{m['max_health']}, items: {', '.join(m['inventory']) or 'none'})"
        for m in state.get("party", [])
    )
    flags = state.get("world_flags", {})
    flags_str = "\n".join(f"  {k}: {v}" for k, v in flags.items()) if flags else "  (none)"

    return f"""{SYSTEM_PROMPT}

=== CURRENT GAME STATE ===
Campaign: {state.get("campaign", "Unknown")}
Location: {state.get("location", "Unknown")}
Active Quest: {state.get("active_quest", "None")}

Party:
{party_lines}

World Flags:
{flags_str}

=== PLAYER ACTION ===
{player_action}

=== RESPONSE (JSON only) ==="""


def _try_parse_json(text: str) -> dict | None:
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                chunk = text[start:i + 1]
                try:
                    return json.loads(chunk)
                except json.JSONDecodeError:
                    return None
    return None


def _name_to_agent(state: dict) -> dict[str, str]:
    return {m["name"]: m["agent"] for m in state.get("party", [])}


def _remap_keys(d: dict[str, Any] | None, name_map: dict[str, str]) -> dict[str, Any] | None:
    if d is None:
        return None
    remapped = {}
    for k, v in d.items():
        agent = name_map.get(k, k)
        remapped[agent] = v
    return remapped


def process_action(gm: GameManager, player_action: str) -> dict:
    state = gm.get_state()
    name_map = _name_to_agent(state)
    prompt = _build_prompt(state, player_action)
    raw = _call_ollama(prompt)
    parsed = _try_parse_json(raw)

    if parsed is None:
        narration = raw.strip() or f"The Game Master ponders your action: {player_action}"
        gm.update(narration=narration)
        return {
            "narration": narration,
            "state": gm.get_state(),
            "trace": gm.get_trace(),
        }

    narration = parsed.get("narration", "").strip() or f"The party proceeds: {player_action}"

    rolls = parsed.get("rolls", [])
    for r in rolls:
        actor = name_map.get(r.get("actor", "")) or r.get("actor", "Warrior")
        check = r.get("check", "Check")
        dc = r.get("difficulty", 10)
        mod = r.get("modifier", 0)
        gm.roll_dice(actor, check, dc, mod)

    updates = parsed.get("state_updates", {})
    gm.update(
        location=updates.get("location"),
        active_quest=updates.get("active_quest"),
        health_changes=_remap_keys(updates.get("health_changes"), name_map),
        inventory_add=updates.get("inventory_add"),
        inventory_remove=updates.get("inventory_remove"),
        flags_set=updates.get("flags_set"),
        narration=narration,
    )

    return {
        "narration": narration,
        "state": gm.get_state(),
        "trace": gm.get_trace(),
    }
