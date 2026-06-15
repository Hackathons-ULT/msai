from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Union

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.agent_workflow import LocalAgentWorkflow
from src.class_stats import apply_class_stats
from src.game_manager import GameManager
from src.state import GameState, PartyMember
from src.retrieval import build_lore_retriever

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
    campaign="The Smog of Aethelgard",
    location="The Sump",
    active_quest="Investigate the Clockwork Plague",
    party=[
        apply_class_stats(PartyMember(agent="Warrior", name="Jax", health=20)),
        apply_class_stats(PartyMember(agent="Mage", name="Lyra", health=16, inventory=["Staff"])),
        apply_class_stats(PartyMember(agent="Healer", name="Bram", health=18, inventory=["Medkit"])),
        apply_class_stats(PartyMember(agent="Bard", name="Seren", health=16, inventory=["Lute"])),
        apply_class_stats(PartyMember(agent="Rival", name="Kael", health=20, inventory=["Hidden Blade"])),
    ],
    player_character="Warrior",
    objectives=[
        {"id": "main",     "text": "Investigate the Clockwork Plague",   "status": "active"},
        {"id": "sector04", "text": "Locate the Sector-04 Pressure Core", "status": "todo"},
        {"id": "brass",    "text": "Retrieve the Brass Cylinder",        "status": "todo"},
        {"id": "culprit",  "text": "Uncover who caused the Plague",      "status": "todo"},
        {"id": "spire",    "text": "Reach the Upper-Spire",              "status": "todo"},
    ],
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
    campaign: str = "The Smog of Aethelgard"
    location: str = "The Sump"
    active_quest: str = "Investigate the Clockwork Plague"


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
        {"name": "Warrior", "ico": "[X]", "desc": "Brute strength & steel", "lore": "Jax is a former factory enforcer who grew up in the Sump. Iron-willed and direct. Best for combat, forcing doors, and head-on confrontations. Naturally strong and tough."},
        {"name": "Mage", "ico": "[*]", "desc": "Arcane wisdom & power", "lore": "Lyra is a self-taught scholar studying the corrupted aether flowing through Aethelgard. Best for deciphering runes, investigating anomalies, and arcane problem-solving. Naturally smart and perceptive."},
        {"name": "Healer", "ico": "[+]", "desc": "Restoration & support", "lore": "Bram is a field medic who defected from the Engineers' medical corps. Best for keeping the party alive, negotiating peacefully, and navigating moral dilemmas. Naturally wise and persuasive."},
        {"name": "Bard", "ico": "[~]", "desc": "Music & inspiration", "lore": "Seren is a wandering minstrel who uses charm and verse to move through dangerous crowds. Best for persuasion, information-gathering, and social manipulation. Naturally charming and quick."},
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
