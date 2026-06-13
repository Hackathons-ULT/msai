from src.state import GameState, PartyMember
from src.game_manager import GameManager


def test_initial_state():
    gm = GameManager()
    assert gm.get_state()["campaign"] == ""
    assert gm.get_trace() == []


def test_roll_adds_to_trace():
    gm = GameManager()
    result = gm.roll_dice("Warrior", "Strength", 10)
    assert result["actor"] == "Warrior"
    assert len(gm.get_trace()) == 1
    assert gm.get_trace()[0]["type"] == "dice"


def test_update_state():
    gm = GameManager(
        state=GameState(
            campaign="Test",
            party=[PartyMember(agent="Warrior", name="Thorn")],
        )
    )
    errs = gm.update(location="Dungeon", health_changes={"Warrior": -5})
    assert errs == []
    assert gm.get_state()["location"] == "Dungeon"
    assert gm.get_state()["party"][0]["health"] == 15


def test_update_adds_trace():
    gm = GameManager()
    gm.update(location="Forest")
    assert len(gm.get_trace()) == 1
    assert gm.get_trace()[0]["type"] == "state_update"


def test_narration_only_adds_one_trace_entry():
    gm = GameManager()
    gm.update(narration="You enter a dark cave.")
    assert len(gm.get_trace()) == 1
    assert gm.get_trace()[0]["type"] == "narration"


def test_update_and_narration_adds_two_entries():
    gm = GameManager()
    gm.update(location="Dungeon", narration="You descend into darkness.")
    assert len(gm.get_trace()) == 2
    assert gm.get_trace()[0]["type"] == "state_update"
    assert gm.get_trace()[1]["type"] == "narration"


def test_clear_trace():
    gm = GameManager()
    gm.roll_dice("Rogue", "Stealth", 10)
    gm.update(location="Cave")
    assert len(gm.get_trace()) == 2
    gm.clear_trace()
    assert gm.get_trace() == []


def test_get_trace_returns_copy():
    gm = GameManager()
    gm.roll_dice("Mage", "Arcana", 10)
    trace = gm.get_trace()
    trace.append({"type": "fake"})
    assert len(gm.get_trace()) == 1


def test_multiple_rolls_and_updates():
    gm = GameManager(
        state=GameState(
            campaign="Lost Sigil",
            party=[PartyMember(agent="Warrior", name="Thorn", health=20)],
        )
    )
    gm.roll_dice("Warrior", "Athletics", 12)
    gm.update(health_changes={"Warrior": -7}, location="Bridge", flags_set={"bridge_crossed": True})
    gm.roll_dice("Warrior", "Perception", 14)

    state = gm.get_state()
    trace = gm.get_trace()

    assert state["party"][0]["health"] == 13
    assert state["location"] == "Bridge"
    assert state["world_flags"]["bridge_crossed"] is True
    assert len(trace) == 3
    assert trace[0]["type"] == "dice"
    assert trace[1]["type"] == "state_update"
    assert trace[2]["type"] == "dice"
