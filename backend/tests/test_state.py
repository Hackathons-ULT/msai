from src.state import GameState, PartyMember


def test_create_party_member():
    m = PartyMember(agent="Warrior", name="Thorn")
    assert m.agent == "Warrior"
    assert m.name == "Thorn"
    assert m.health == 20
    assert m.max_health == 20
    assert m.inventory == []


def test_party_member_to_dict():
    m = PartyMember(agent="Mage", name="Elara", health=15, inventory=["Staff", "Potion"])
    d = m.to_dict()
    assert d["agent"] == "Mage"
    assert d["name"] == "Elara"
    assert d["health"] == 15
    assert d["inventory"] == ["Staff", "Potion"]


def test_party_member_from_dict():
    d = {"agent": "Rogue", "name": "Vex", "health": 18, "max_health": 20, "inventory": ["Dagger"]}
    m = PartyMember.from_dict(d)
    assert m.agent == "Rogue"
    assert m.health == 18
    assert m.inventory == ["Dagger"]


def test_game_state_defaults():
    gs = GameState()
    assert gs.campaign == ""
    assert gs.location == ""
    assert gs.active_quest == ""
    assert gs.party == []
    assert gs.world_flags == {}


def test_game_state_to_dict():
    gs = GameState(
        campaign="Test",
        location="Village",
        active_quest="Explore",
        party=[PartyMember(agent="Warrior", name="Thorn")],
        world_flags={"started": True},
    )
    d = gs.to_dict()
    assert d["campaign"] == "Test"
    assert d["location"] == "Village"
    assert len(d["party"]) == 1
    assert d["party"][0]["agent"] == "Warrior"
    assert d["world_flags"] == {"started": True}


def test_game_state_from_dict_roundtrip():
    original = GameState(
        campaign="Lost Sigil",
        location="Dungeon",
        active_quest="Find artifact",
        party=[
            PartyMember(agent="Warrior", name="Thorn"),
            PartyMember(agent="Mage", name="Elara", health=14, inventory=["Wand"]),
        ],
        world_flags={"door_open": False, "rival_trust": "uncertain"},
    )
    d = original.to_dict()
    restored = GameState.from_dict(d)
    assert restored.campaign == original.campaign
    assert restored.location == original.location
    assert len(restored.party) == 2
    assert restored.get_party_member("Mage").health == 14
    assert restored.get_party_member("Mage").inventory == ["Wand"]
    assert restored.world_flags["rival_trust"] == "uncertain"


def test_get_party_member_found():
    gs = GameState(party=[PartyMember(agent="Healer", name="Luna")])
    assert gs.get_party_member("Healer").name == "Luna"


def test_get_party_member_not_found():
    gs = GameState(party=[PartyMember(agent="Healer", name="Luna")])
    assert gs.get_party_member("Warrior") is None


def test_missing_keys_safe():
    gs = GameState.from_dict({})
    assert gs.campaign == ""
    assert gs.party == []
    assert gs.world_flags == {}
