# Backend API Reference

Base URL: `http://localhost:8000`

---

## `GET /`

Health check.

```json
{"name": "MSAI RPG Backend", "status": "ok"}
```

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

## `POST /roll`

Roll a d20 check for a character.

**Request:**
```json
{
  "actor": "Warrior",
  "check": "Athletics",
  "difficulty": 12,
  "modifier": 0
}
```

`modifier` is optional (default 0).

**Response:**
```json
{
  "actor": "Warrior",
  "check": "Athletics",
  "roll": 16,
  "modifier": 0,
  "total": 16,
  "difficulty": 12,
  "result": "success",
  "consequence": "A stroke of luck — Warrior succeeds."
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
