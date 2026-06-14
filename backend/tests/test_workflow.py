import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.src.agent_workflow import LocalAgentWorkflow
from backend.src.game_manager import GameManager
from backend.src.state import GameState, PartyMember
from backend.src.tools import LocalLoreRetriever


def make_workflow():
    gm = GameManager(
        state=GameState(
            campaign="The Lost Sigil",
            location="Whispering Woods",
            active_quest="Find the ancient artifact",
            party=[
                PartyMember(agent="Warrior", name="Thorn"),
                PartyMember(agent="Mage", name="Elara", inventory=["Staff"]),
                PartyMember(agent="Rogue", name="Vex"),
                PartyMember(agent="Healer", name="Luna"),
            ],
        )
    )
    return LocalAgentWorkflow(gm, lore_retriever=LocalLoreRetriever())


def test_empty_action_requests_clarification():
    wf = make_workflow()
    result = wf.run_turn("   ")
    assert "clearer action" in result.narration.lower()
    assert result.choices


def test_combat_action_plans_and_traces():
    wf = make_workflow()
    result = wf.run_turn("Attack the guardian at the Iron Sluice")
    assert result.plan["intent"] == "combat"
    assert "Warrior" in result.plan["agents"]
    assert result.trace[-1]["type"] == "narration_outcome"
    assert result.lore["chunks"]


def test_travel_action_can_update_location():
    wf = make_workflow()
    result = wf.run_turn("Go to the Sunken Market and inspect the stalls")
    assert result.state["location"] == "Sunken Market"
    assert result.plan["intent"] in ("travel", "investigate")
    assert result.trace[-1]["type"] == "narration_outcome"


def test_rival_scope_is_used_for_secret_queries():
    wf = make_workflow()
    result = wf.run_turn("Can we trust the rival and learn their secret?")
    assert result.plan["scope"] == "gm"
    assert result.lore["chunks"]
