from src.dice import roll_d20


def test_roll_returns_required_keys():
    result = roll_d20("Warrior", "Strength", 15)
    assert set(result.keys()) == {"actor", "check", "roll", "modifier", "total", "difficulty", "result", "consequence"}


def test_roll_fields_match_input():
    result = roll_d20("Rogue", "Stealth", 14, modifier=2)
    assert result["actor"] == "Rogue"
    assert result["check"] == "Stealth"
    assert result["difficulty"] == 14
    assert result["modifier"] == 2


def test_roll_within_range():
    for _ in range(100):
        r = roll_d20("Warrior", "Strength", 10)
        assert 1 <= r["roll"] <= 20
        assert r["total"] == r["roll"] + r["modifier"]


def test_result_success_when_far_above_difficulty():
    for _ in range(100):
        r = roll_d20("Mage", "Magic", 1, modifier=10)
        assert r["result"] == "success"


def test_result_failure_when_total_below_difficulty():
    r = roll_d20("Mage", "Magic", 999)
    assert r["result"] == "failure"


def test_result_with_modifier():
    r = roll_d20("Fighter", "Athletics", 15, modifier=5)
    assert r["total"] == r["roll"] + 5


def test_consequence_is_non_empty_string():
    r = roll_d20("Rogue", "Perception", 10)
    assert isinstance(r["consequence"], str)
    assert len(r["consequence"]) > 0


def test_consequence_contains_actor_name():
    r = roll_d20("Warrior", "Intimidation", 12)
    assert "Warrior" in r["consequence"]


def test_result_is_success_or_failure():
    for _ in range(100):
        r = roll_d20("Rogue", "Stealth", 12)
        assert r["result"] in ("success", "failure")


def test_high_roll_is_success():
    for _ in range(100):
        r = roll_d20("Mage", "Arcana", 10, modifier=15)
        assert r["result"] == "success"


def test_low_roll_is_failure():
    for _ in range(100):
        r = roll_d20("Mage", "Arcana", 20, modifier=-10)
        assert r["result"] == "failure"
