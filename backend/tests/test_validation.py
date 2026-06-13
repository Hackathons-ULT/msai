from src.state import GameState, PartyMember
from src.validation import validate_and_apply


def make_state(**kwargs) -> GameState:
    defaults = dict(
        campaign="Test",
        location="Start",
        active_quest="Quest",
        party=[PartyMember(agent="Warrior", name="Thorn", health=20, max_health=20)],
        world_flags={},
    )
    defaults.update(kwargs)
    return GameState(**defaults)


def test_update_location():
    state, errs = validate_and_apply(make_state(), location="Dungeon")
    assert state.location == "Dungeon"
    assert errs == []


def test_update_quest():
    state, errs = validate_and_apply(make_state(), active_quest="Slay the beast")
    assert state.active_quest == "Slay the beast"
    assert errs == []


def test_health_damage():
    state, errs = validate_and_apply(make_state(), health_changes={"Warrior": -5})
    assert state.get_party_member("Warrior").health == 15
    assert errs == []


def test_health_heal():
    state = make_state()
    state.get_party_member("Warrior").health = 12
    state, errs = validate_and_apply(state, health_changes={"Warrior": +3})
    assert state.get_party_member("Warrior").health == 15
    assert errs == []


def test_health_clamps_to_max():
    state, errs = validate_and_apply(make_state(), health_changes={"Warrior": +999})
    assert state.get_party_member("Warrior").health == 20
    assert errs == []


def test_health_clamps_to_zero():
    state, errs = validate_and_apply(make_state(), health_changes={"Warrior": -999})
    assert state.get_party_member("Warrior").health == 0
    assert "0 HP" in errs[0]


def test_unknown_agent_health():
    state, errs = validate_and_apply(make_state(), health_changes={"Ghost": -5})
    assert "Unknown agent: Ghost" in errs


def test_inventory_add():
    state = make_state()
    state, errs = validate_and_apply(state, inventory_add={"Warrior": ["Sword", "Shield"]})
    assert state.get_party_member("Warrior").inventory == ["Sword", "Shield"]
    assert errs == []


def test_inventory_add_unknown_agent():
    state, errs = validate_and_apply(make_state(), inventory_add={"Ghost": ["Sword"]})
    assert "Unknown agent: Ghost" in errs


def test_inventory_remove():
    state = make_state()
    state.get_party_member("Warrior").inventory = ["Sword", "Potion", "Key"]
    state, errs = validate_and_apply(state, inventory_remove={"Warrior": ["Potion"]})
    assert state.get_party_member("Warrior").inventory == ["Sword", "Key"]
    assert errs == []


def test_inventory_remove_missing_item():
    state = make_state()
    state, errs = validate_and_apply(state, inventory_remove={"Warrior": ["Potion"]})
    assert "does not have" in errs[0]


def test_flag_set_new():
    state, errs = validate_and_apply(make_state(), flags_set={"door_open": True})
    assert state.world_flags["door_open"] is True
    assert errs == []


def test_flag_overwrite_warning():
    state = make_state(world_flags={"door_open": False})
    state, errs = validate_and_apply(state, flags_set={"door_open": True})
    assert state.world_flags["door_open"] is True
    assert "already set" in errs[0]


def test_multiple_updates_at_once():
    state = make_state()
    state, errs = validate_and_apply(
        state,
        location="Cave",
        health_changes={"Warrior": -10},
        inventory_add={"Warrior": ["Torch"]},
        flags_set={"cave_entered": True},
    )
    assert state.location == "Cave"
    assert state.get_party_member("Warrior").health == 10
    assert state.get_party_member("Warrior").inventory == ["Torch"]
    assert state.world_flags["cave_entered"] is True
    assert errs == []


def test_no_changes_returns_original():
    state = make_state()
    state2, errs = validate_and_apply(state)
    assert state2 is state
    assert errs == []
