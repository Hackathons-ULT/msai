from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.game_manager import GameManager
from backend.state import GameState, PartyMember

app = FastAPI(title="MSAI RPG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

gm = GameManager(
    state=GameState(
        campaign="The Lost Sigil",
        location="Whispering Woods",
        active_quest="Find the ancient artifact",
        party=[
            PartyMember(agent="Warrior", name="Thorn", health=20),
            PartyMember(agent="Mage", name="Elara", health=16, inventory=["Staff"]),
            PartyMember(agent="Rogue", name="Vex", health=18, inventory=["Dagger", "Lockpicks"]),
            PartyMember(agent="Healer", name="Luna", health=14, inventory=["Herbs"]),
        ],
    )
)


class RollRequest(BaseModel):
    actor: str
    check: str
    difficulty: int
    modifier: int = 0


class UpdateRequest(BaseModel):
    location: str | None = None
    active_quest: str | None = None
    health_changes: dict[str, int] | None = None
    inventory_add: dict[str, list[str]] | None = None
    inventory_remove: dict[str, list[str]] | None = None
    flags_set: dict[str, bool | str] | None = None
    narration: str | None = None


@app.get("/")
def root():
    return {"name": "MSAI RPG Backend", "status": "ok"}


@app.get("/state")
def get_state():
    return gm.get_state()


@app.post("/roll")
def roll(body: RollRequest):
    result = gm.roll_dice(body.actor, body.check, body.difficulty, body.modifier)
    return result


@app.post("/update")
def update_state(body: UpdateRequest):
    errors = gm.update(
        location=body.location,
        active_quest=body.active_quest,
        health_changes=body.health_changes,
        inventory_add=body.inventory_add,
        inventory_remove=body.inventory_remove,
        flags_set=body.flags_set,
        narration=body.narration,
    )
    return {"state": gm.get_state(), "warnings": errors}


@app.get("/trace")
def get_trace():
    return gm.get_trace()


@app.post("/trace/clear")
def clear_trace():
    gm.clear_trace()
    return {"status": "ok"}
