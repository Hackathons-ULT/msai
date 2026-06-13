from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.agent_workflow import LocalAgentWorkflow
from src.game_manager import GameManager
from src.state import GameState, PartyMember
from src.tools import LocalLoreRetriever

BASE_DIR = Path(__file__).resolve().parent
ASSETS_DIR = BASE_DIR / "assets"

app = FastAPI(title="MSAI RPG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_STATE = GameState(
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

gm = GameManager(state=GameState.from_dict(DEFAULT_STATE.to_dict()))
workflow = LocalAgentWorkflow(gm, lore_retriever=LocalLoreRetriever(BASE_DIR / "world_pack"))


class ResetRequest(BaseModel):
    campaign: str = "The Lost Sigil"
    location: str = "Whispering Woods"
    active_quest: str = "Find the ancient artifact"
    party: list[dict] = [
        {"agent": "Warrior", "name": "Thorn", "health": 20, "max_health": 20, "inventory": []},
        {"agent": "Mage", "name": "Elara", "health": 16, "max_health": 20, "inventory": ["Staff"]},
        {"agent": "Rogue", "name": "Vex", "health": 18, "max_health": 20, "inventory": ["Dagger", "Lockpicks"]},
        {"agent": "Healer", "name": "Luna", "health": 14, "max_health": 20, "inventory": ["Herbs"]},
    ]
    world_flags: dict[str, bool | str] = {}


class RollRequest(BaseModel):
    actor: str
    check: str
    difficulty: int
    modifier: int = 0


class TurnRequest(BaseModel):
    action: str
    session_id: str = "default"


class UpdateRequest(BaseModel):
    location: str | None = None
    active_quest: str | None = None
    health_changes: dict[str, int] | None = None
    inventory_add: dict[str, list[str]] | None = None
    inventory_remove: dict[str, list[str]] | None = None
    flags_set: dict[str, bool | str] | None = None
    narration: str | None = None


app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/character-types")
def character_types():
    return ["Warrior", "Mage", "Rogue", "Healer"]


@app.get("/")
def root():
    return {"name": "MSAI RPG Backend", "status": "ok"}


@app.post("/turn")
def turn(body: TurnRequest):
    result = workflow.run_turn(body.action, body.session_id)
    return {
        "narration": result.narration,
        "choices": result.choices,
        "state": result.state,
        "trace": result.trace,
        "plan": result.plan,
        "lore": result.lore,
        "dice": result.dice,
        "warnings": result.warnings,
    }


@app.post("/action")
def action(body: TurnRequest):
    return turn(body)


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


@app.post("/reset")
def reset_game(body: ResetRequest):
    global gm, workflow
    party = [PartyMember.from_dict(m) for m in body.party]
    gm = GameManager(
        state=GameState(
            campaign=body.campaign,
            location=body.location,
            active_quest=body.active_quest,
            party=party,
            world_flags=dict(body.world_flags),
        )
    )
    workflow = LocalAgentWorkflow(gm, lore_retriever=LocalLoreRetriever(BASE_DIR / "world_pack"))
    return {"status": "ok", "state": gm.get_state()}
