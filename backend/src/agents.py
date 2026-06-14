from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class AgentPerspective:
    name: str
    role: str
    thought: str
    suggestion: str


class BasePersona:
    name = "Agent"
    role = "general"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        return AgentPerspective(
            name=self.name,
            role=self.role,
            thought="Standing by.",
            suggestion="Proceed carefully.",
        )


class WarriorPersona(BasePersona):
    name = "Warrior"
    role = "combat"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        lowered = action.lower()
        if any(k in lowered for k in ("attack", "fight", "battle", "defend")):
            thought = "This is a direct confrontation; set the front line."
            suggestion = "Take the aggressive angle and protect the group."
        else:
            thought = "Strength matters if the scene turns physical."
            suggestion = "Keep a strong position and move decisively."
        return AgentPerspective(self.name, self.role, thought, suggestion)


class MagePersona(BasePersona):
    name = "Mage"
    role = "arcana"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        lowered = action.lower()
        if any(k in lowered for k in ("magic", "spell", "rune", "artifact", "arcane")):
            thought = "The scene likely hides magical structure."
            suggestion = f"Focus on the lore: {lore_snippet[:120]}"
        else:
            thought = "Even mundane scenes may have hidden rules."
            suggestion = "Search for the odd detail and test the pattern."
        return AgentPerspective(self.name, self.role, thought, suggestion)


class RoguePersona(BasePersona):
    name = "Rogue"
    role = "stealth"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        lowered = action.lower()
        if any(k in lowered for k in ("sneak", "lock", "trap", "steal", "pick")):
            thought = "There is likely a hidden route or concealed mechanism."
            suggestion = "Look for the easiest way in, not the loudest."
        else:
            thought = "I should scan for routes and weak spots."
            suggestion = "Use observation first and spend power only when needed."
        return AgentPerspective(self.name, self.role, thought, suggestion)


class HealerPersona(BasePersona):
    name = "Healer"
    role = "support"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        lowered = action.lower()
        if any(k in lowered for k in ("heal", "wound", "hurt", "injury", "restore")):
            thought = "Party stability matters most right now."
            suggestion = "Prioritize safety and keep everyone standing."
        else:
            thought = "I should watch for the cost of the scene."
            suggestion = "Preserve resources and morale."
        return AgentPerspective(self.name, self.role, thought, suggestion)


class BardPersona(BasePersona):
    name = "Bard"
    role = "inspire"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        lowered = action.lower()
        if any(k in lowered for k in ("persuade", "talk", "negotiate", "sing", "perform", "charm")):
            thought = "Words can open doors that blades cannot."
            suggestion = "Use the moment — a well-placed story or song shifts the mood entirely."
        else:
            thought = "Every scene has a narrative angle worth exploiting."
            suggestion = "Read the room and find what the others are missing."
        return AgentPerspective(self.name, self.role, thought, suggestion)


class RivalPersona(BasePersona):
    name = "Rival"
    role = "disruptive"

    def observe(self, action: str, lore_snippet: str) -> AgentPerspective:
        return AgentPerspective(
            self.name,
            self.role,
            "The obvious answer is probably incomplete.",
            "Assume there is a twist, a price, or a hidden motive.",
        )


PERSONAS = {
    "Warrior": WarriorPersona(),
    "Mage": MagePersona(),
    "Rogue": RoguePersona(),
    "Healer": HealerPersona(),
    "Bard": BardPersona(),
    "Rival": RivalPersona(),
}
