from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class PartyMember:
    agent: str
    name: str
    health: int = 20
    max_health: int = 20
    inventory: list[str] = field(default_factory=list)
    strength: int = 10
    dexterity: int = 10
    constitution: int = 10
    intelligence: int = 10
    wisdom: int = 10
    charisma: int = 10

    def modifier(self, stat: int) -> int:
        return (stat - 10) // 2

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> PartyMember:
        return cls(**data)


@dataclass
class GameState:
    campaign: str = ""
    location: str = ""
    active_quest: str = ""
    party: list[PartyMember] = field(default_factory=list)
    world_flags: dict[str, bool | str] = field(default_factory=dict)
    player_character: str = ""  # agent name of the human-controlled character (never "Rival")
    objectives: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "campaign": self.campaign,
            "location": self.location,
            "active_quest": self.active_quest,
            "party": [m.to_dict() for m in self.party],
            "world_flags": dict(self.world_flags),
            "player_character": self.player_character,
            "objectives": list(self.objectives),
        }

    @classmethod
    def from_dict(cls, data: dict) -> GameState:
        party = [PartyMember.from_dict(m) for m in data.get("party", [])]
        return cls(
            campaign=data.get("campaign", ""),
            location=data.get("location", ""),
            active_quest=data.get("active_quest", ""),
            party=party,
            world_flags=dict(data.get("world_flags", {})),
            player_character=data.get("player_character", ""),
            objectives=list(data.get("objectives", [])),
        )

    def get_party_member(self, agent: str) -> Optional[PartyMember]:
        for m in self.party:
            if m.agent == agent:
                return m
        return None
