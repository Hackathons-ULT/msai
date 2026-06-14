from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any

from .agents import AgentAction, PERSONAS
from .game_manager import GameManager
from .llm import LocalLLMClient
from .retrieval import FoundryIQLoreRetriever, build_lore_retriever
from .tools import LocalLoreRetriever, RetrievedLore, RPGTools


@dataclass
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
    source: str = "heuristic"


@dataclass
class TurnResult:
    narration: str
    narration_setup: str
    narration_outcome: str
    followups: list[dict]
    choices: list[str]
    state: dict
    trace: list[dict]
    plan: dict
    lore: dict
    dice: dict | None
    warnings: list[str]


CHECK_TO_STAT = {
    "Combat": "strength",
    "Support": "wisdom",
    "Stealth": "dexterity",
    "Investigation": "intelligence",
    "Traversal": "dexterity",
    "Arcana": "intelligence",
    "Persuasion": "charisma",
}


class LocalAgentWorkflow:
    """Local orchestration that mirrors the intended Agent Framework turn loop.

    The workflow uses an OpenAI-compatible chat endpoint when credentials are
    configured, but remains fully runnable with deterministic fallbacks.
    """

    def __init__(
        self,
        gm: GameManager,
        lore_retriever: FoundryIQLoreRetriever | LocalLoreRetriever | None = None,
        tools: RPGTools | None = None,
        llm: LocalLLMClient | None = None,
    ) -> None:
        self.gm = gm
        self.tools = tools or RPGTools(gm)
        self.lore_retriever = lore_retriever or build_lore_retriever()
        self.llm = llm or LocalLLMClient.from_env()
        self._pending_intro: str | None = None

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
                    "source": "fallback",
                },
            )
            self.gm.update(narration="The Game Master waits for a clearer action.")
            return TurnResult(
                narration="The Game Master waits for a clearer action.",
                narration_setup="The Game Master waits for a clearer action.",
                narration_outcome="",
                followups=[],
                choices=["Describe what your character does."],
                state=self.gm.get_state(),
                trace=self.gm.get_trace(),
                plan={"intent": "clarify", "agents": [], "needs_dice": False, "source": "fallback"},
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
                "source": plan.source,
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

        specialist_notes: list[str] = []
        for agent_name in plan.agents:
            note = self._consult_agent(agent_name, action, lore, plan)
            specialist_notes.append(note)
            self.gm.record_trace(
                "agent",
                {
                    "session_id": session_id,
                    "agent": agent_name,
                    "note": note,
                    "source": "llm" if self.llm.available else "fallback",
                },
            )

        dice_result = None
        if plan.needs_dice:
            actor = plan.dice_actor or self._primary_actor(plan.agents)
            check = plan.dice_check or self._default_check_for_intent(plan.intent)
            stat_name = CHECK_TO_STAT.get(check, "strength")
            state = self.gm.get_state()
            member = next((m for m in state.get("party", []) if m.get("agent") == actor), None)
            stat_value = member.get(stat_name, 10) if member else 10
            modifier = (stat_value - 10) // 2
            dice_result = self.tools.roll_dice(
                actor=actor,
                check=check,
                difficulty=plan.dice_difficulty or self._difficulty_for_intent(plan.intent),
                modifier=modifier,
            )

        state_patch = self._derive_state_patch(action, plan, lore, dice_result)
        warnings: list[str] = []
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

        narration_setup, narration_outcome = self._compose_narration(
            action, plan, lore, specialist_notes, dice_result, warnings
        )
        followups = self._generate_followups(plan, dice_result)

        followup_text = ""
        if followups:
            followup_text = " " + " ".join(f["narration"] for f in followups)

        full_narration = narration_setup + (" " + narration_outcome if narration_outcome else "") + followup_text
        self.gm.update(narration=full_narration)

        choices = self._build_choices(plan.intent, dice_result)
        return TurnResult(
            narration=full_narration,
            narration_setup=narration_setup,
            narration_outcome=narration_outcome,
            followups=followups,
            choices=choices,
            state=self.gm.get_state(),
            trace=self.gm.get_trace(),
            plan=asdict(plan),
            lore=lore.to_dict(),
            dice=dice_result,
            warnings=warnings,
        )

    def _build_plan(self, action: str, session_id: str) -> TurnPlan:
        heuristic = self._heuristic_plan(action, session_id)
        if not self.llm.available:
            return heuristic

        llm_plan = self._llm_build_plan(action, session_id)
        if not llm_plan:
            return heuristic

        # Merge LLM output with safe defaults.
        heuristic.intent = llm_plan.get("intent", heuristic.intent) or heuristic.intent
        heuristic.agents = self._clean_agents(llm_plan.get("agents", heuristic.agents))
        heuristic.needs_dice = bool(llm_plan.get("needs_dice", heuristic.needs_dice))
        heuristic.dice_actor = llm_plan.get("dice_actor") or heuristic.dice_actor
        heuristic.dice_check = llm_plan.get("dice_check") or heuristic.dice_check
        heuristic.dice_difficulty = self._coerce_int(llm_plan.get("dice_difficulty"), heuristic.dice_difficulty)
        heuristic.retrieval_query = llm_plan.get("retrieval_query", heuristic.retrieval_query) or heuristic.retrieval_query
        heuristic.scope = llm_plan.get("scope", heuristic.scope) or heuristic.scope
        if isinstance(llm_plan.get("state_patch"), dict):
            heuristic.state_patch = llm_plan["state_patch"]
        heuristic.source = "llm"
        return heuristic

    def _heuristic_plan(self, action: str, session_id: str) -> TurnPlan:
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
            source="heuristic",
        )

    def _llm_build_plan(self, action: str, session_id: str) -> dict[str, Any] | None:
        state = self.gm.get_state()
        prompt = (
            "You are the Game Master planner for a fantasy RPG.\n"
            "Return ONLY a JSON object with keys:\n"
            "intent, agents, needs_dice, dice_actor, dice_check, dice_difficulty, retrieval_query, scope, state_patch.\n"
            "Allowed intents: combat, support, stealth, travel, investigate, arcana, social, clarify.\n"
            "Allowed scope values: player or gm.\n"
            "Use only agent names from the current party when selecting agents.\n"
            "Keep retrieval_query concise. state_patch must be a JSON object.\n"
        )
        user = {
            "session_id": session_id,
            "action": action,
            "campaign": state.get("campaign", ""),
            "location": state.get("location", ""),
            "active_quest": state.get("active_quest", ""),
            "party": [m.get("agent") for m in state.get("party", [])],
            "world_flags": state.get("world_flags", {}),
        }
        result = self.llm.complete(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
            ],
            temperature=0.1,
            max_tokens=400,
            json_mode=True,
        )
        if not result.used or not result.text:
            return None

        data = self._extract_json(result.text)
        return data if isinstance(data, dict) else None

    def _extract_json(self, text: str) -> Any:
        text = text.strip()
        try:
            return json.loads(text)
        except Exception:
            pass
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except Exception:
            return None

    def _clean_agents(self, agents: Any) -> list[str]:
        party_names = {m["agent"] for m in self.gm.get_state().get("party", [])}
        clean: list[str] = []
        for agent in agents or []:
            if isinstance(agent, str) and agent in party_names and agent not in clean:
                clean.append(agent)
        return clean or self._select_agents("social", "")

    def _coerce_int(self, value: Any, default: int | None = None) -> int | None:
        try:
            return int(value)
        except Exception:
            return default

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
        party_names = {m["agent"] for m in self.gm.get_state().get("party", [])}
        agents = [a for a in agents if a in party_names]
        seen = set()
        deduped = []
        for agent in agents:
            if agent not in seen:
                seen.add(agent)
                deduped.append(agent)
        if not deduped:
            deduped = list(party_names)[:1] if party_names else ["Warrior"]
        return deduped

    def _build_retrieval_query(self, action: str, intent: str) -> str:
        state = self.gm.get_state()
        parts = [action, state.get("location", ""), state.get("active_quest", "")]
        if intent == "arcana":
            parts.append("artifact lore")
        if intent == "combat":
            parts.append("bestiary enemy tactics")
        return " | ".join(part for part in parts if part)

    def _consult_agent(self, agent_name: str, action: str, lore: RetrievedLore, plan: TurnPlan) -> str:
        if self.llm.available:
            system = (
                f"You are the {agent_name} persona in a fantasy RPG party.\n"
                "Respond in one short sentence, staying in character.\n"
                "Your reply should help the Game Master reason about the player's action.\n"
            )
            user = {
                "action": action,
                "intent": plan.intent,
                "retrieved_lore": [chunk.to_dict() for chunk in lore.chunks],
                "current_location": self.gm.get_state().get("location", ""),
                "current_quest": self.gm.get_state().get("active_quest", ""),
                "party": [m.get("agent") for m in self.gm.get_state().get("party", [])],
            }
            result = self.llm.complete(
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
                ],
                temperature=0.3,
                max_tokens=160,
            )
            if result.used and result.text:
                return result.text.strip()

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
            if "find" in lowered or "recover" in lowered or "retrieve" in lowered:
                patch["flags_set"] = {"quest_progress": "advanced"}

        if not dice_result:
            return {k: v for k, v in patch.items() if v}

        outcome = dice_result.get("result", "failure")
        actor = dice_result.get("actor", "")
        patch.setdefault("flags_set", {})
        patch["flags_set"]["last_outcome"] = outcome

        intent = plan.intent
        if intent == "combat":
            if outcome == "success":
                patch["flags_set"]["enemy_damaged"] = True
            elif outcome == "failure":
                patch.setdefault("health_changes", {})
                patch["health_changes"][actor] = -2

        elif intent == "support":
            party = state.get("party", [])
            wounded = [m for m in party if m.get("health", 20) < m.get("max_health", 20)]
            if outcome == "success" and wounded:
                patch.setdefault("health_changes", {})
                patch["health_changes"][wounded[0]["agent"]] = 4
            elif outcome == "partial" and wounded:
                patch.setdefault("health_changes", {})
                patch["health_changes"][wounded[0]["agent"]] = 2

        elif intent == "stealth":
            if outcome == "success":
                patch["flags_set"]["undetected"] = True
            elif outcome == "failure":
                patch["flags_set"]["detected"] = True

        elif intent == "investigate":
            if outcome == "success":
                patch["flags_set"]["clue_found"] = True
            elif outcome == "partial":
                patch["flags_set"]["partial_clue"] = True

        elif intent == "travel":
            if outcome == "failure":
                patch["flags_set"]["lost"] = True

        elif intent == "arcana":
            if outcome == "success":
                patch["flags_set"]["lore_revealed"] = True
            elif outcome == "partial":
                patch["flags_set"]["partial_lore"] = True
            elif outcome == "failure":
                patch["flags_set"]["wild_magic"] = True

        elif intent == "social":
            if outcome == "success":
                patch["flags_set"]["persuaded"] = True
            elif outcome == "failure":
                patch["flags_set"]["offended"] = True

        return {k: v for k, v in patch.items() if v}

    def _compose_narration(
        self,
        action: str,
        plan: TurnPlan,
        lore: RetrievedLore,
        specialist_notes: list[str],
        dice_result: dict | None,
        warnings: list[str],
    ) -> tuple[str, str]:
        first_citation = lore.citations[0] if lore.citations else "local world pack"
        note_bits = " | ".join(f"{agent}: {note}" for agent, note in zip(plan.agents, specialist_notes))
        setup = (
            f"The party considers: {action}. "
            f"Grounded by {first_citation}. "
            f"{note_bits}."
        )
        outcome = ""
        if dice_result:
            outcome = f"The check landed as {dice_result['result']} ({dice_result['total']} vs DC {dice_result['difficulty']})."
            if dice_result.get("consequence"):
                outcome += f" {dice_result['consequence']}"
            setup += " The Game Master calls for a die roll."
        if warnings:
            outcome = outcome + " " + " ".join(warnings) if outcome else " ".join(warnings)
        return setup.strip(), outcome.strip()

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

    def run_intro(self, session_id: str = "default") -> str:
        state = self.gm.get_state()
        party = state.get("party", [])
        intro_parts = [f"The party arrives at {state.get('location', 'their destination')}."]
        for member in party:
            persona = PERSONAS.get(member["agent"])
            if persona:
                action = persona.act_intro(state)
                intro_parts.append(action.narration)
                if action.state_patch:
                    self.tools.apply_patch(action.state_patch)
                self.gm.record_trace("agent_intro", {"agent": member["agent"], "action": action.narration})
        intro_parts.append("The Game Master looks to you. What do you do?")
        intro_text = " ".join(intro_parts)
        self.gm.update(narration=intro_text)
        self._pending_intro = intro_text
        return intro_text

    def _generate_followups(self, plan: TurnPlan, dice_result: dict | None) -> list[dict]:
        state = self.gm.get_state()
        followups: list[AgentAction] = []
        processed: set[str] = set()
        outcome = (dice_result or {}).get("result")
        for member in state.get("party", []):
            name = member["agent"]
            persona = PERSONAS.get(name)
            if not persona or name in processed:
                continue
            action = persona.act_followup(state, plan.intent, outcome)
            if action:
                processed.add(name)
                followups.append(action)
                if action.state_patch:
                    self.tools.apply_patch(action.state_patch)
                self.gm.record_trace("agent_followup", {"agent": name, "action": action.narration})
        return [
            {"agent": f.agent, "narration": f.narration, "dice": f.dice}
            for f in followups
        ]

    def pop_intro(self) -> str | None:
        text = self._pending_intro
        self._pending_intro = None
        return text


def build_workflow(gm: GameManager) -> LocalAgentWorkflow:
    """Compatibility hook for a future Agent Framework builder."""
    return LocalAgentWorkflow(gm)
