# Backend API Reference

Base URL: `http://localhost:8000`

---

## `GET /`

Health check.

```json
{"name": "MSAI RPG Backend", "status": "ok"}
```

---

## `GET /character-types`

Returns the list of available character classes.

**Response:**
```json
["Warrior", "Mage", "Rogue", "Healer"]
```

---

## `POST /turn`

Main game loop — send a player action and get the narrated scene + updated state.

The backend classifies intent, selects relevant party agents, retrieves lore, optionally rolls dice, and composes narration. When a dice roll is needed, the response includes `narration_setup` (GM calls for the roll) and `narration_outcome` (result shown after the frontend animates the roll).

**Request:**
```json
{
  "action": "I attack the goblin with my sword",
  "session_id": "default"
}
```

`session_id` is optional (defaults to `"default"`). Will support multiple concurrent games later.

**Response:**
```json
{
  "narration": "The party considers: I attack the goblin with my sword. Grounded by local world pack. Warrior: Charge in decisively... The check landed as success (18 vs DC 14). Thorn pulls it off cleanly.",
  "narration_setup": "The party considers: I attack the goblin with my sword. Grounded by local world pack. Warrior: Charge in decisively... The Game Master calls for a die roll.",
  "narration_outcome": "The check landed as success (18 vs DC 14). Thorn pulls it off cleanly.",
  "choices": ["Press the attack.", "Hold position and defend.", "Coordinate with the Rogue for an opening."],
  "state": { "...full game state (see GET /state)..." },
  "trace": [ "...reasoning trace entries..." ],
  "plan": {
    "action": "I attack the goblin with my sword",
    "session_id": "default",
    "intent": "combat",
    "agents": ["Warrior", "Mage", "Rogue"],
    "needs_dice": true,
    "dice_actor": "Warrior",
    "dice_check": "Combat",
    "dice_difficulty": 14,
    "state_patch": {},
    "retrieval_query": "I attack the goblin with my sword | Whispering Woods | Find the ancient artifact",
    "scope": "player"
  },
  "lore": {
    "query": "I attack the goblin with my sword | Whispering Woods | Find the ancient artifact",
    "scope": "player",
    "chunks": [],
    "citations": ["local world pack"]
  },
  "dice": {
    "actor": "Warrior",
    "check": "Combat",
    "roll": 16,
    "modifier": 0,
    "total": 18,
    "difficulty": 14,
    "result": "success",
    "consequence": "Thorn pulls it off cleanly."
  },
  "warnings": []
}
```

When no dice roll is needed, `dice` is `null`, `narration_setup` equals `narration`, and `narration_outcome` is `""`.

---

## `POST /action`

Alias for `POST /turn`. Accepts the same request format and returns the same response.

---

## `GET /state`

Returns the full game state: campaign info, party, location, flags.

```json
{
  "campaign": "The Lost Sigil",
  "location": "Whispering Woods",
  "active_quest": "Find the ancient artifact",
  "party": [
    {
      "agent": "Warrior",
      "name": "Thorn",
      "health": 20,
      "max_health": 20,
      "inventory": []
    }
  ],
  "world_flags": {}
}
```

---

## `POST /update`

Update game state and/or add narration. All fields are optional — only send what changed.

**Request:**
```json
{
  "location": "Dungeon",
  "active_quest": "Defeat the boss",
  "health_changes": {"Warrior": -5, "Mage": 3},
  "inventory_add": {"Warrior": ["Iron Sword"]},
  "inventory_remove": {"Rogue": ["Lockpicks"]},
  "flags_set": {"gate_open": true},
  "narration": "Thorn pushes the heavy gate open."
}
```

For narration alone (no state change):
```json
{
  "narration": "A cold wind blows through the corridor."
}
```

**Response:**
```json
{
  "state": { "...full game state..." },
  "warnings": []
}
```

`warnings` contains messages like `"Thorn is at 0 HP"` or `"Flag 'gate_open' already set"`.

---

## `GET /trace`

Returns the reasoning trace — every dice roll, state update, and narration since the last clear.

```json
[
  {
    "type": "dice",
    "actor": "Rogue",
    "check": "Stealth",
    "roll": 17,
    "modifier": 0,
    "total": 17,
    "difficulty": 14,
    "result": "success"
  },
  {
    "type": "state_update",
    "location": "Goblin Camp",
    "active_quest": null,
    "health_changes": null,
    "inventory_add": null,
    "inventory_remove": null,
    "flags_set": {"guard_bypassed": true}
  },
  {
    "type": "narration",
    "text": "Vex slips past the goblin guard."
  }
]
```

---

## `POST /trace/clear`

Empties the trace log.

```json
{"status": "ok"}
```

---

## `POST /reset`

Reset the game to a fresh state. All fields are optional — defaults create the standard party.

**Request:**
```json
{
  "campaign": "The Lost Sigil",
  "location": "Whispering Woods",
  "active_quest": "A new quest",
  "party": [
    {
      "agent": "Warrior",
      "name": "Thorn",
      "health": 20,
      "max_health": 20,
      "inventory": []
    }
  ],
  "world_flags": {}
}
```

**Response:**
```json
{
  "status": "ok",
  "state": { "...full game state..." }
}
```
