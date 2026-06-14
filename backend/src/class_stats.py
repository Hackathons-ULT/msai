from __future__ import annotations

from .state import PartyMember

CLASS_STATS: dict[str, dict[str, int]] = {
    "Warrior": {"strength": 15, "dexterity": 13, "constitution": 14, "intelligence": 8, "wisdom": 12, "charisma": 10},
    "Mage": {"strength": 8, "dexterity": 13, "constitution": 12, "intelligence": 15, "wisdom": 14, "charisma": 10},
    "Healer": {"strength": 8, "dexterity": 12, "constitution": 13, "intelligence": 10, "wisdom": 15, "charisma": 14},
    "Bard": {"strength": 8, "dexterity": 14, "constitution": 13, "intelligence": 12, "wisdom": 10, "charisma": 15},
    "Rogue": {"strength": 8, "dexterity": 15, "constitution": 12, "intelligence": 14, "wisdom": 10, "charisma": 13},
    "Rival": {"strength": 13, "dexterity": 12, "constitution": 13, "intelligence": 12, "wisdom": 10, "charisma": 13},
}


def apply_class_stats(member: PartyMember) -> PartyMember:
    stats = CLASS_STATS.get(member.agent)
    if stats:
        for stat, value in stats.items():
            setattr(member, stat, value)
    return member
