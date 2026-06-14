from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class AgentAction:
    agent: str
    narration: str
    dice: dict | None = None
    state_patch: dict[str, Any] | None = None


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(agent=self.name, narration=f"{self.name} stands ready.")

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        return None


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} plants their feet and surveys the area for threats, shield at the ready.",
        )

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        if intent == "combat":
            if outcome == "success":
                return AgentAction(
                    agent=self.name,
                    narration=f"{self.name} presses the advantage, driving forward while the enemy is off-balance.",
                )
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} tightens their grip and holds formation, ready for the next blow.",
            )
        if intent in ("travel", "investigate"):
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} takes a defensive position, watching for anything that moves.",
            )
        return None


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} whispers a detection cantrip — the air thrums with latent energy.",
        )

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        if intent in ("combat", "investigate", "arcana"):
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} sifts through the arcane residue, cataloguing what was left behind.",
            )
        if intent == "travel":
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} checks the new area for magical wards or hidden enchantments.",
            )
        return None


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} slips into the shadows, circling wide to get the lay of the land.",
        )

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        if intent in ("travel", "investigate", "stealth"):
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} scouts ahead, finding a promising route forward.",
            )
        if intent == "combat" and outcome == "success":
            return AgentAction(
                agent=self.name,
                narration=f"{self.name} fades into cover, looking for a flanking opportunity.",
            )
        return None


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} checks the party's gear and vitals, ensuring everyone is fit for the road ahead.",
        )

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        if intent == "combat":
            injured = [m for m in state.get("party", []) if m.get("health", 20) < m.get("max_health", 20)]
            if injured:
                return AgentAction(
                    agent=self.name,
                    narration=f"{self.name} tends to {injured[0]['name']}'s wounds, restoring a measure of strength.",
                    state_patch={"health_changes": {injured[0]["agent"]: 3}},
                )
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} keeps a watchful eye on the party's condition, ready to act.",
        )


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

    def act_intro(self, state: dict) -> AgentAction:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} watches from a distance, a knowing smirk playing at the corner of their mouth.",
        )

    def act_followup(self, state: dict, intent: str, outcome: str | None) -> AgentAction | None:
        return AgentAction(
            agent=self.name,
            narration=f"{self.name} mutters something under their breath — it might be advice, it might be a warning.",
        )


PERSONAS = {
    "Warrior": WarriorPersona(),
    "Mage": MagePersona(),
    "Rogue": RoguePersona(),
    "Healer": HealerPersona(),
    "Bard": BardPersona(),
    "Rival": RivalPersona(),
}
