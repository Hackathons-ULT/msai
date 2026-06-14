from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Union

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.src.agent_workflow import LocalAgentWorkflow
from backend.src.class_stats import apply_class_stats
from backend.src.game_manager import GameManager
from backend.src.state import GameState, PartyMember
from backend.src.retrieval import build_lore_retriever

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
        PartyMember(agent="Warrior", name="Jax", health=20),
        PartyMember(agent="Mage", name="Lyra", health=16, inventory=["Staff"]),
        PartyMember(agent="Healer", name="Bram", health=18, inventory=["Medkit"]),
        PartyMember(agent="Bard", name="Seren", health=16, inventory=["Lute"]),
        PartyMember(agent="Rival", name="Kael", health=20, inventory=["Hidden Blade"]),
    ],
    player_character="Warrior",
)

gm = GameManager(state=GameState.from_dict(DEFAULT_STATE.to_dict()))
workflow = LocalAgentWorkflow(gm, lore_retriever=build_lore_retriever())


class ResetRequest(BaseModel):
    campaign: str = "The Lost Sigil"
    location: str = "Whispering Woods"
    active_quest: str = "Find the ancient artifact"
    party: List[dict] = [
        {"agent": "Warrior", "name": "Jax", "health": 20, "max_health": 20, "inventory": []},
        {"agent": "Mage", "name": "Lyra", "health": 16, "max_health": 20, "inventory": ["Staff"]},
        {"agent": "Healer", "name": "Bram", "health": 18, "max_health": 20, "inventory": ["Medkit"]},
        {"agent": "Bard", "name": "Seren", "health": 16, "max_health": 20, "inventory": ["Lute"]},
        {"agent": "Rival", "name": "Kael", "health": 20, "max_health": 20, "inventory": ["Hidden Blade"]},
    ]
    world_flags: Dict[str, Union[bool, str]] = {}
    player_character: str = "Warrior"


class TurnRequest(BaseModel):
    action: str
    session_id: str = "default"


class UpdateRequest(BaseModel):
    location: Optional[str] = None
    active_quest: Optional[str] = None
    health_changes: Optional[Dict[str, int]] = None
    inventory_add: Optional[Dict[str, List[str]]] = None
    inventory_remove: Optional[Dict[str, List[str]]] = None
    flags_set: Optional[Dict[str, Union[bool, str]]] = None
    narration: Optional[str] = None


app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/character-types")
def character_types():
    return [
        {"name": "Warrior", "ico": "\u2694", "desc": "Brute strength & steel"},
        {"name": "Mage", "ico": "\u2726", "desc": "Arcane wisdom & power"},
        {"name": "Healer", "ico": "\u271A", "desc": "Restoration & support"},
        {"name": "Bard", "ico": "\u266B", "desc": "Music & inspiration"},
    ]  # Rival (Kael) is AI-only, never player-pickable


@app.get("/")
def root():
    return {"name": "MSAI RPG Backend", "status": "ok"}


@app.post("/turn")
def turn(body: TurnRequest):
    result = workflow.run_turn(body.action, body.session_id)
    return {
        "narration": result.narration,
        "narration_setup": result.narration_setup,
        "narration_outcome": result.narration_outcome,
        "followups": result.followups,
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


@app.get("/intro")
def get_intro():
    text = workflow.pop_intro()
    if text:
        return {"narration": text, "pending": True}
    return {"narration": "", "pending": False}


@app.post("/reset")
def reset_game(body: ResetRequest):
    global gm, workflow
    party = [apply_class_stats(PartyMember.from_dict(m)) for m in body.party]
    gm = GameManager(
        state=GameState(
            campaign=body.campaign,
            location=body.location,
            active_quest=body.active_quest,
            party=party,
            world_flags=dict(body.world_flags),
            player_character=body.player_character,
        )
    )
    workflow = LocalAgentWorkflow(gm, lore_retriever=build_lore_retriever())
    workflow.run_intro()
    return {"status": "ok", "state": gm.get_state(), "intro": workflow.pop_intro()}
