from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .game_manager import GameManager
from .tools import LocalLoreRetriever, RetrievedLore, RPGTools


@dataclass(slots=True)
class TurnPlan:
    action: str
    session_id: str
    intent: str
    agents: list[str] = field(default_factory=list)
    needs_dice: bool = False
    dice_actor: str | None = None
    dice_check: str | None = None
    dice_difficulty: int | None = None
    state_patch: dict[str, Any] = field(default_factory=dict)
    retrieval_query: str = ""
    scope: str = "player"


@dataclass(slots=True)
class TurnResult:
    narration: str
    choices: list[str]
    state: dict
    trace: list[dict]
    plan: dict
    lore: dict
    dice: dict | None
    warnings: list[str]


class LocalAgentWorkflow:
    """A local orchestration layer that mirrors the intended Agent Framework flow.

    The implementation is deterministic and self-contained so the app works even
    without a live Foundry integration. The orchestration boundaries are kept
    explicit so a hosted Agent Framework or Foundry IQ client can be swapped in
    later with minimal changes.
    """

    def __init__(
        self,
        gm: GameManager,
        lore_retriever: LocalLoreRetriever | None = None,
        tools: RPGTools | None = None,
    ) -> None:
        self.gm = gm
        self.tools = tools or RPGTools(gm)
        self.lore_retriever = lore_retriever or LocalLoreRetriever()

    def reset_game_manager(self, gm: GameManager) -> None:
        self.gm = gm
        self.tools = RPGTools(gm)

    def run_turn(self, action: str, session_id: str = "default") -> TurnResult:
        action = (action or "").strip()
        if not action:
            self.gm.record_trace(
                "planner",
                {
                    "session_id": session_id,
                    "intent": "clarify",
                    "reason": "empty_action",
                },
            )
            self.gm.update(
                narration="The Game Master waits for a clearer action.",
            )
            return TurnResult(
                narration="The Game Master waits for a clearer action.",
                choices=["Describe what your character does."],
                state=self.gm.get_state(),
                trace=self.gm.get_trace(),
                plan={"intent": "clarify", "agents": [], "needs_dice": False},
                lore={"chunks": [], "citations": [], "query": ""},
                dice=None,
                warnings=[],
            )

        plan = self._build_plan(action, session_id)
        self.gm.record_trace(
            "planner",
            {
                "session_id": session_id,
                "intent": plan.intent,
                "agents": plan.agents,
                "needs_dice": plan.needs_dice,
                "retrieval_query": plan.retrieval_query,
            },
        )

        lore = self.lore_retriever.retrieve(plan.retrieval_query, scope=plan.scope)
        self.gm.record_trace(
            "retrieval",
            {
                "session_id": session_id,
                "query": plan.retrieval_query,
                "scope": plan.scope,
                "citations": lore.citations,
            },
        )

        specialist_notes = []
        for agent_name in plan.agents:
            note = self._consult_agent(agent_name, action, lore)
            specialist_notes.append(note)
            self.gm.record_trace(
                "agent",
                {
                    "session_id": session_id,
                    "agent": agent_name,
                    "note": note,
                },
            )

        dice_result = None
        if plan.needs_dice:
            dice_result = self.tools.roll_dice(
                actor=plan.dice_actor or self._primary_actor(plan.agents),
                check=plan.dice_check or self._default_check_for_intent(plan.intent),
                difficulty=plan.dice_difficulty or self._difficulty_for_intent(plan.intent),
            )
            self.gm.record_trace("dice", dice_result)

        state_patch = self._derive_state_patch(action, plan, lore, dice_result)
        warnings = []
        if state_patch:
            warnings = self.tools.apply_patch(state_patch)
            self.gm.record_trace(
                "state_update",
                {
                    "session_id": session_id,
                    "patch": state_patch,
                    "warnings": warnings,
                },
            )

        narration = self._compose_narration(action, plan, lore, specialist_notes, dice_result, warnings)
        self.gm.update(narration=narration)

        choices = self._build_choices(plan.intent, dice_result)
        return TurnResult(
            narration=narration,
            choices=choices,
            state=self.gm.get_state(),
            trace=self.gm.get_trace(),
            plan=asdict(plan),
            lore=lore.to_dict(),
            dice=dice_result,
            warnings=warnings,
        )

    def _build_plan(self, action: str, session_id: str) -> TurnPlan:
        lowered = action.lower()
        intent = self._classify_intent(lowered)
        agents = self._select_agents(intent, lowered)
        needs_dice = any(key in lowered for key in ("attack", "fight", "strike", "roll", "search", "scout", "sneak", "force", "pick", "persuade"))
        if intent in {"travel", "explore", "investigate"}:
            needs_dice = True

        state_patch: dict[str, Any] = {}
        retrieval_query = self._build_retrieval_query(action, intent)
        scope = "gm" if "secret" in lowered or "trust" in lowered else "player"

        primary_actor = self._primary_actor(agents)
        return TurnPlan(
            action=action,
            session_id=session_id,
            intent=intent,
            agents=agents,
            needs_dice=needs_dice,
            dice_actor=primary_actor,
            dice_check=self._default_check_for_intent(intent),
            dice_difficulty=self._difficulty_for_intent(intent),
            state_patch=state_patch,
            retrieval_query=retrieval_query,
            scope=scope,
        )

    def _classify_intent(self, lowered_action: str) -> str:
        if any(k in lowered_action for k in ("attack", "strike", "fight", "battle", "slash")):
            return "combat"
        if any(k in lowered_action for k in ("heal", "revive", "cure", "restore")):
            return "support"
        if any(k in lowered_action for k in ("sneak", "steal", "pick", "lock", "trap", "shadow")):
            return "stealth"
        if any(k in lowered_action for k in ("go to", "travel", "move to", "enter", "head to", "walk to", "run to", "cross")):
            return "travel"
        if any(k in lowered_action for k in ("inspect", "search", "investigate", "look", "study", "scan")):
            return "investigate"
        if any(k in lowered_action for k in ("cast", "magic", "spell", "rune", "arcane", "artifact")):
            return "arcana"
        return "social"

    def _select_agents(self, intent: str, lowered_action: str) -> list[str]:
        mapping = {
            "combat": ["Warrior", "Mage", "Rogue"],
            "support": ["Healer", "Mage"],
            "stealth": ["Rogue", "Warrior"],
            "investigate": ["Rogue", "Mage", "Healer"],
            "travel": ["Rogue", "Warrior"],
            "arcana": ["Mage", "Rogue"],
            "social": ["Healer", "Rival"],
        }
        agents = list(mapping.get(intent, ["Warrior", "Mage"]))
        if "rival" in lowered_action or "trust" in lowered_action:
            agents.append("Rival")
        # Preserve order while deduplicating.
        seen = set()
        deduped = []
        for agent in agents:
            if agent not in seen:
                seen.add(agent)
                deduped.append(agent)
        return deduped

    def _build_retrieval_query(self, action: str, intent: str) -> str:
        state = self.gm.get_state()
        parts = [action, state.get("location", ""), state.get("active_quest", "")]
        if intent == "arcana":
            parts.append("artifact lore")
        if intent == "combat":
            parts.append("bestiary enemy tactics")
        return " | ".join(part for part in parts if part)

    def _consult_agent(self, agent_name: str, action: str, lore: RetrievedLore) -> str:
        action_lc = action.lower()
        first_chunk = lore.chunks[0].content if lore.chunks else "No lore retrieved."
        if agent_name == "Warrior":
            if any(k in action_lc for k in ("attack", "fight", "battle", "defend")):
                return "Charge in decisively and keep the party in formation."
            return "Hold the line and use strength when the moment becomes dangerous."
        if agent_name == "Mage":
            if any(k in action_lc for k in ("magic", "spell", "artifact", "rune", "arcane")):
                return f"Interpret the magical pattern and anchor it to lore: {first_chunk[:160]}"
            return f"Look for hidden structure in the lore: {first_chunk[:160]}"
        if agent_name == "Rogue":
            if any(k in action_lc for k in ("sneak", "trap", "lock", "steal", "pick")):
                return "Move quietly, test the edges, and identify the simplest path."
            return "Scan for routes, pressure points, and things that can be missed."
        if agent_name == "Healer":
            if any(k in action_lc for k in ("heal", "wound", "hurt", "help")):
                return "Preserve the party first, then push for a safe resolution."
            return "Keep morale stable and watch for harm hidden behind the scene."
        if agent_name == "Rival":
            return "Push back on the easy answer; there is usually a cost or a twist."
        return "Stay ready and respond to the GM."

    def _primary_actor(self, agents: list[str]) -> str:
        if not agents:
            return "Warrior"
        return agents[0]

    def _default_check_for_intent(self, intent: str) -> str:
        return {
            "combat": "Combat",
            "support": "Support",
            "stealth": "Stealth",
            "investigate": "Investigation",
            "travel": "Traversal",
            "arcana": "Arcana",
            "social": "Persuasion",
        }.get(intent, "Action")

    def _difficulty_for_intent(self, intent: str) -> int:
        return {
            "combat": 14,
            "support": 12,
            "stealth": 13,
            "investigate": 12,
            "travel": 11,
            "arcana": 13,
            "social": 12,
        }.get(intent, 12)

    def _derive_state_patch(
        self,
        action: str,
        plan: TurnPlan,
        lore: RetrievedLore,
        dice_result: dict | None,
    ) -> dict[str, Any]:
        patch: dict[str, Any] = {}
        lowered = action.lower()
        state = self.gm.get_state()

        # Travel: if a known location appears in the action, move there.
        known_locations = {
            "whispering woods": "Whispering Woods",
            "iron sluice": "Iron Sluice",
            "glass arch": "Glass Arch",
            "sunken market": "Sunken Market",
            "north gate": "North Gate",
        }
        for needle, location in known_locations.items():
            if needle in lowered:
                patch["location"] = location
                break

        if any(k in lowered for k in ("quest", "artifact", "sigil")) and state.get("active_quest"):
            # Leave the quest as-is unless the action clearly advances it.
            if "find" in lowered or "recover" in lowered or "retrieve" in lowered:
                patch["flags_set"] = {"quest_progress": "advanced"}

        if dice_result:
            if dice_result.get("result") == "success":
                patch.setdefault("flags_set", {})
                patch["flags_set"]["last_outcome"] = "success"
            elif dice_result.get("result") == "partial":
                patch.setdefault("flags_set", {})
                patch["flags_set"]["last_outcome"] = "partial"
            else:
                patch.setdefault("flags_set", {})
                patch["flags_set"]["last_outcome"] = "failure"

        if "heal" in lowered:
            patch.setdefault("health_changes", {})
            patch["health_changes"]["Healer"] = 1

        # Avoid generating no-op patches with empty nested dicts.
        cleaned = {k: v for k, v in patch.items() if v}
        return cleaned

    def _compose_narration(
        self,
        action: str,
        plan: TurnPlan,
        lore: RetrievedLore,
        specialist_notes: list[str],
        dice_result: dict | None,
        warnings: list[str],
    ) -> str:
        first_citation = lore.citations[0] if lore.citations else "local world pack"
        note_bits = " | ".join(f"{agent}: {note}" for agent, note in zip(plan.agents, specialist_notes))
        dice_bits = ""
        if dice_result:
            dice_bits = f" The check landed as {dice_result['result']} ({dice_result['total']} vs DC {dice_result['difficulty']})."
            if dice_result.get("consequence"):
                dice_bits += f" {dice_result['consequence']}"
        warning_bits = ""
        if warnings:
            warning_bits = " " + " ".join(warnings)
        return (
            f"The party considers: {action}. "
            f"Grounded by {first_citation}. "
            f"{note_bits}."
            f"{dice_bits}"
            f"{warning_bits}"
        ).strip()

    def _build_choices(self, intent: str, dice_result: dict | None) -> list[str]:
        if dice_result and dice_result.get("result") == "failure":
            return [
                "Try a more cautious approach.",
                "Ask the Mage to inspect the scene.",
                "Have the Rogue look for another route.",
            ]
        if intent == "combat":
            return [
                "Press the attack.",
                "Hold position and defend.",
                "Coordinate with the Rogue for an opening.",
            ]
        if intent in {"investigate", "travel", "arcana"}:
            return [
                "Inspect the next clue.",
                "Ask the party to confer.",
                "Move deeper into the area.",
            ]
        return [
            "Continue the conversation.",
            "Ask for more detail.",
            "Change strategy.",
        ]


def build_workflow(gm: GameManager) -> LocalAgentWorkflow:
    """Compatibility hook for a future Agent Framework builder."""
    return LocalAgentWorkflow(gm)
