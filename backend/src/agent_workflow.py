from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any

from .agents import AgentAction, PERSONAS
from .game_manager import GameManager
from .llm import LocalLLMClient
from .retrieval import HybridLoreRetriever, FoundryIQLoreRetriever, build_lore_retriever
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

ALLOWED_AGENTS_BY_INTENT = {
    "combat": {"Warrior", "Mage"},
    "support": {"Healer", "Mage"},
    "stealth": {"Warrior", "Bard"},
    "investigate": {"Mage", "Healer"},
    "travel": {"Warrior", "Mage"},
    "arcana": {"Mage", "Healer"},
    "social": {"Healer", "Bard", "Rival"},
    "clarify": {"Warrior", "Mage", "Healer", "Bard", "Rival"},
}


class LocalAgentWorkflow:
    """Local orchestration that mirrors the intended Agent Framework turn loop.

    The workflow uses an OpenAI-compatible chat endpoint when credentials are
    configured, but remains fully runnable with deterministic fallbacks.
    """

    def __init__(
        self,
        gm: GameManager,
        lore_retriever: HybridLoreRetriever | FoundryIQLoreRetriever | LocalLoreRetriever | None = None,
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

        derived_patch = self._derive_state_patch(action, plan, lore, dice_result)
        llm_patch = plan.state_patch or {}
        # Merge: derived covers dice-driven HP; LLM patch wins on everything else.
        # health_changes are additive — both dice damage and LLM heals can coexist.
        state_patch: dict[str, Any] = {**derived_patch}
        for k, v in llm_patch.items():
            if k == "health_changes" and "health_changes" in derived_patch:
                state_patch["health_changes"] = {**derived_patch["health_changes"], **v}
            else:
                state_patch[k] = v
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
        self._check_story_flags()

        narration_setup, narration_outcome = self._compose_narration(
            action, plan, lore, specialist_notes, dice_result, warnings, state_patch
        )
        followups = self._generate_followups(plan, dice_result)

        full_narration = narration_setup + (" " + narration_outcome if narration_outcome else "")
        self.gm.update(narration=full_narration)
        self.gm.record_trace("narration_setup", {"text": narration_setup})
        self.gm.record_trace("narration_outcome", {"text": narration_outcome})

        choices = self._build_choices(plan.intent, dice_result, full_narration, action)
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

    def _check_story_flags(self) -> None:
        """Auto-set kael_revealed and victory world flags based on current state."""
        state = self.gm.get_state()
        flags = state.get("world_flags", {})
        party = state.get("party", [])

        rival = next((m for m in party if m.get("agent") == "Rival"), None)
        if rival and rival.get("health", 1) <= 0 and not flags.get("kael_revealed"):
            self.gm.update(flags_set={"kael_revealed": True})
            self.gm.record_trace("state_update", {"flags_set": {"kael_revealed": True}})

        if flags.get("kael_revealed") and not flags.get("victory"):
            objectives = state.get("objectives", [])
            culprit_done = any(
                o.get("id") == "culprit" and o.get("status") == "done"
                for o in objectives
            )
            if culprit_done:
                self.gm.update(flags_set={"victory": True})
                self.gm.record_trace("state_update", {"flags_set": {"victory": True}})

    def _build_plan(self, action: str, session_id: str) -> TurnPlan:
        heuristic = self._heuristic_plan(action, session_id)
        if not self.llm.available:
            return heuristic

        llm_plan = self._llm_build_plan(action, session_id)
        if not llm_plan:
            return heuristic

        # Merge LLM's refinements with safe heuristic defaults.
        # Routing and dice mechanics stay anchored to the heuristic plan
        # so turns cannot drift into invalid state.
        heuristic.intent = llm_plan.get("intent", heuristic.intent) or heuristic.intent
        heuristic.needs_dice = bool(llm_plan.get("needs_dice", heuristic.needs_dice))
        heuristic.dice_actor = llm_plan.get("dice_actor") or heuristic.dice_actor
        heuristic.dice_check = llm_plan.get("dice_check") or heuristic.dice_check
        heuristic.dice_difficulty = self._coerce_int(
            llm_plan.get("dice_difficulty"), heuristic.dice_difficulty
        )
        retrieval_query = self._sanitize_retrieval_query(llm_plan.get("retrieval_query"))
        if retrieval_query:
            heuristic.retrieval_query = retrieval_query
        heuristic.scope = llm_plan.get("scope", heuristic.scope) or heuristic.scope

        # The GM (LLM) proposes state changes; sanitize and use them.
        llm_patch = llm_plan.get("state_patch")
        if isinstance(llm_patch, dict):
            sanitized = self._sanitize_state_patch(llm_patch)
            if sanitized:
                heuristic.state_patch = sanitized
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
            "Return ONLY a compact JSON object with these keys:\n"
            "intent (string), agents (list of strings), needs_dice (bool),\n"
            "dice_actor (string or null), dice_check (string or null),\n"
            "dice_difficulty (int or null), retrieval_query (string),\n"
            "scope (\"player\" or \"gm\"), state_patch (object).\n\n"
            "Allowed intents: combat, support, stealth, travel, investigate, arcana, social, clarify.\n"
            "Pick 1-3 agents maximum.\n\n"
            "=== state_patch schema (include to change state, omit {} to keep unchanged) ===\n"
            "health_changes: {\"CharacterName\": +/-N} — damage (negative) or heal (positive); use the character's display name (e.g. \"Kael\", \"Lyra\"); range -20 to +10\n"
            "inventory_add: {\"CharacterName\": [\"item\"]} — give items; use the character's display name\n"
            "inventory_remove: {\"CharacterName\": [\"item\"]} — take items (error if absent); use the character's display name\n"
            "flags_set: {\"flag_name\": true/false or \"string\"} — set story flags. "
            "Use \"{agentkey}_{effect}\": true/false to apply status effects to party members, "
            "where agentkey is lowercase agent role (warrior/mage/healer/bard/rival) and effect is one of: "
            "poisoned, stunned, inspired, burning, shielded, weakened, blessed, cursed. "
            "Example: {\"warrior_poisoned\": true, \"healer_inspired\": true}. Set to false to remove.\n"
            "location: \"New Location\" — change current location (or omit to keep)\n"
            "active_quest: \"New Quest\" — change quest (or omit to keep)\n"
            "objectives: [{\"id\": \"<id>\", \"status\": \"done|active|failed\"}] — mark objectives when clearly completed or failed\n"
            "Keep changes small and dramatic. Be concise. No extra text.\n"
        )
        party_details = [
            {
                "agent": m.get("agent"),
                "name": m.get("name"),
                "health": m.get("health"),
                "max_health": m.get("max_health"),
                "inventory": m.get("inventory", []),
            }
            for m in state.get("party", [])
        ]
        user = {
            "session_id": session_id,
            "action": action,
            "campaign": state.get("campaign", ""),
            "location": state.get("location", ""),
            "active_quest": state.get("active_quest", ""),
            "party": party_details,
            "world_flags": state.get("world_flags", {}),
            "objectives": state.get("objectives", []),
        }
        result = self.llm.complete(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
            ],
            temperature=0.1,
            max_tokens=1200,
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

    def _sanitize_retrieval_query(self, query: Any) -> str:
        if not isinstance(query, str):
            return ""
        parts = [part.strip() for part in re.split(r"[|,\n]+", query) if part.strip()]
        if not parts:
            return ""
        candidate = " ".join(parts[:3])
        candidate = re.sub(r"\s+", " ", candidate).strip()
        tokens = candidate.split()
        if len(tokens) > 12:
            candidate = " ".join(tokens[:12])
        return candidate

    def _sanitize_state_patch(self, patch: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        party = self.gm.get_state().get("party", [])
        # accept both agent role name and character display name
        name_to_agent: dict[str, str] = {}
        for m in party:
            name_to_agent[m["agent"].lower()] = m["agent"]
            if m.get("name"):
                name_to_agent[m["name"].lower()] = m["agent"]
        allowed_top_keys = {"health_changes", "inventory_add", "inventory_remove", "flags_set", "location", "active_quest", "objectives"}

        for key, value in patch.items():
            if key not in allowed_top_keys:
                continue
            if key in ("location", "active_quest"):
                if isinstance(value, str) and value.strip():
                    sanitized[key] = value.strip()
            elif key == "health_changes":
                if not isinstance(value, dict):
                    continue
                hc = {}
                for name, delta in value.items():
                    agent = name_to_agent.get(name.lower()) if isinstance(name, str) else None
                    if agent and isinstance(delta, (int, float)):
                        hc[agent] = max(-20, min(10, int(delta)))
                if hc:
                    sanitized[key] = hc
            elif key in ("inventory_add", "inventory_remove"):
                if not isinstance(value, dict):
                    continue
                inv = {}
                for name, items in value.items():
                    agent = name_to_agent.get(name.lower()) if isinstance(name, str) else None
                    if agent and isinstance(items, list):
                        valid = [str(i).strip() for i in items if isinstance(i, str) and i.strip()]
                        if valid:
                            inv[agent] = valid
                if inv:
                    sanitized[key] = inv
            elif key == "flags_set":
                if isinstance(value, dict):
                    flags = {}
                    for fk, fv in value.items():
                        if isinstance(fk, str) and isinstance(fv, (bool, str)):
                            flags[fk] = fv
                    if flags:
                        sanitized[key] = flags
            elif key == "objectives":
                if not isinstance(value, list):
                    continue
                current_ids = {o["id"] for o in self.gm.get_state().get("objectives", [])}
                valid_statuses = {"active", "done", "failed", "todo"}
                updates = [
                    {"id": item["id"], "status": item["status"]}
                    for item in value
                    if isinstance(item, dict)
                    and item.get("id") in current_ids
                    and item.get("status") in valid_statuses
                ]
                if updates:
                    sanitized[key] = updates
        return sanitized

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
            "combat": ["Warrior", "Mage"],
            "support": ["Healer", "Mage"],
            "stealth": ["Warrior", "Bard"],
            "investigate": ["Mage", "Healer"],
            "travel": ["Warrior", "Mage"],
            "arcana": ["Mage", "Healer"],
            "social": ["Healer", "Bard", "Rival"],
        }
        agents = list(mapping.get(intent, ["Warrior", "Mage"]))
        if "rival" in lowered_action or "trust" in lowered_action:
            agents.append("Rival")
        # Only include alive party members (health > 0)
        party_alive = {m["agent"] for m in self.gm.get_state().get("party", []) if m.get("health", 1) > 0}
        agents = [a for a in agents if a in party_alive]
        seen = set()
        deduped = []
        for agent in agents:
            if agent not in seen:
                seen.add(agent)
                deduped.append(agent)
        if not deduped:
            deduped = list(party_alive)[:1] if party_alive else ["Warrior"]
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
        intent = plan.intent
        patch.setdefault("flags_set", {})

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

        elif intent == "stealth":
            if outcome == "success":
                patch["flags_set"]["undetected"] = True
            elif outcome == "failure":
                patch["flags_set"]["detected"] = True

        elif intent == "investigate":
            if outcome == "success":
                patch["flags_set"]["clue_found"] = True

        elif intent == "travel":
            if outcome == "failure":
                patch["flags_set"]["lost"] = True

        elif intent == "arcana":
            if outcome == "success":
                patch["flags_set"]["lore_revealed"] = True
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
        state_patch: dict[str, Any] | None = None,
    ) -> tuple[str, str]:
        llm_result = self._llm_compose_narration(action, plan, lore, specialist_notes, dice_result, warnings, state_patch)
        if llm_result is not None:
            setup, outcome = llm_result
            if warnings:
                outcome = outcome + " " + " ".join(warnings) if outcome else " ".join(warnings)
            return setup.strip(), outcome.strip()

        first_citation = lore.citations[0] if lore.citations else "local world pack"
        note_bits = " | ".join(f"{agent}: {note}" for agent, note in zip(plan.agents, specialist_notes))
        state = self.gm.get_state()
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
        else:
            location = state.get("location", "their destination")
            lore_bit = ""
            if lore.chunks:
                lore_bit = " " + lore.chunks[0].content[:120]
            outcome = f"The party continues onward at {location}.{lore_bit}"
        if warnings:
            outcome = outcome + " " + " ".join(warnings) if outcome else " ".join(warnings)
        return setup.strip(), outcome.strip()

    def _shorten_text(self, text: str, limit: int = 160) -> str:
        text = re.sub(r"\s+", " ", (text or "").strip())
        if len(text) <= limit:
            return text
        cut = text[:limit].rsplit(" ", 1)[0].strip()
        return cut + "…" if cut else text[:limit] + "…"

    def _llm_compose_narration(
        self,
        action: str,
        plan: TurnPlan,
        lore: RetrievedLore,
        specialist_notes: list[str],
        dice_result: dict | None,
        warnings: list[str],
        state_patch: dict[str, Any] | None = None,
    ) -> tuple[str, str] | None:
        if not self.llm.available:
            return None

        state = self.gm.get_state()
        party_names = [m.get("name", m.get("agent", "?")) for m in state.get("party", [])]
        party_agents = [m.get("agent", "?") for m in state.get("party", [])]
        lore_snippets = [chunk.content[:200] for chunk in lore.chunks[:2]]
        note_lines = [f"{agent}: {note}" for agent, note in zip(plan.agents, specialist_notes)]

        dice_info = ""
        if dice_result:
            mod = dice_result.get("modifier", 0)
            mod_str = f" +{mod}" if mod > 0 else f" {mod}" if mod < 0 else ""
            dice_info = (
                f"Dice rolled: {dice_result.get('roll', '?')}{mod_str} "
                f"= {dice_result.get('total', '?')} vs DC {dice_result.get('difficulty', '?')} "
                f"→ {dice_result.get('result', '?').upper()}"
            )
            if dice_result.get("consequence"):
                dice_info += f" (consequence: {dice_result['consequence']})"

        state_changes = ""
        if state_patch:
            lines = []
            if "location" in state_patch:
                lines.append(f"Location changed to {state_patch['location']}")
            if "active_quest" in state_patch:
                lines.append(f"Quest updated to {state_patch['active_quest']}")
            if "health_changes" in state_patch:
                party_list = state.get("party", [])
                for agent, delta in state_patch["health_changes"].items():
                    direction = "damage" if delta < 0 else "healing"
                    member = next((m for m in party_list if m.get("agent") == agent), None)
                    hp = member.get("health", "?") if member else "?"
                    lines.append(f"{agent} takes {abs(delta)} {direction} (now at {hp} HP)")
            if "inventory_add" in state_patch:
                for agent, items in state_patch["inventory_add"].items():
                    lines.append(f"{agent} receives: {', '.join(items)}")
            if "inventory_remove" in state_patch:
                for agent, items in state_patch["inventory_remove"].items():
                    lines.append(f"{agent} loses: {', '.join(items)}")
            if "flags_set" in state_patch:
                flag_str = ", ".join(f"{k}={v}" for k, v in state_patch["flags_set"].items())
                lines.append(f"Flags set: {flag_str}")
            if lines:
                state_changes = "\n".join(lines)

        dead_members = [m.get("name", m.get("agent")) for m in state.get("party", []) if m.get("health", 1) <= 0]
        dead_note = ""
        if dead_members:
            dead_note = (
                f"\nCRITICAL: The following party members are DEAD (0 HP) and must NOT speak, act, "
                f"or be described as doing anything: {', '.join(dead_members)}. "
                f"They can only be mentioned as fallen/unconscious bodies.\n"
            )

        system_prompt = (
            "You are the Game Master narrating a fantasy RPG turn.\n"
            "Write TWO paragraphs separated by the exact delimiter: ---PART TWO---\n\n"
            "Part One (Setup): The narrative lead-up to the player's action. Describe the scene,\n"
            "the party's position, and build tension. Incorporate the retrieved lore and the\n"
            "agents' perspectives naturally into the description.\n\n"
            "Part Two (Outcome): The narrative result of the action. Describe what actually happens.\n"
            "Blend any dice result into the story. A success means the action lands well,\n"
            "a failure means complications arise.\n"
            "If there is no dice, describe a natural consequence of the action.\n"
            "Weave the mechanical state changes listed below into the narrative naturally.\n"
            "Do not list them mechanically; describe them as part of the story.\n\n"
            "Write in present tense, third person. Keep each paragraph to 2-4 sentences.\n"
            "Do not label the parts. Just write them separated by the delimiter.\n"
            "IMPORTANT: Never declare a character dead, killed, or permanently incapacitated unless their HP is explicitly 0 in the party health data below. "
            "A character with HP above 0 is still alive and fighting, even if they take damage this turn."
            + dead_note
        )

        # Build active status effects string for narrator context
        flags = state.get("world_flags", {})
        effect_names = ["poisoned","stunned","inspired","burning","shielded","weakened","blessed","cursed"]
        active_effects = []
        for m in state.get("party", []):
            ak = m.get("agent","").lower()
            effs = [e for e in effect_names if flags.get(ak+"_"+e)]
            if effs:
                active_effects.append(f"{m.get('name', ak)}: {', '.join(effs)}")
        effects_str = ("; ".join(active_effects)) if active_effects else "none"

        user_prompt = (
            f"Campaign: {state.get('campaign', '?')}\n"
            f"Location: {state.get('location', '?')}\n"
            f"Active Quest: {state.get('active_quest', 'none')}\n"
            f"Party health: {', '.join(m.get('name', m.get('agent')) + ' HP ' + str(m.get('health', 0)) + '/' + str(m.get('max_health', 20)) for m in state.get('party', []))}\n"
            f"Party status effects: {effects_str}\n"
            f"Party: {', '.join(f'{n} ({a})' for n, a in zip(party_names, party_agents))}\n"
            f"Player Character: {state.get('player_character', 'the hero')}\n\n"
            f"Player action: \"{action}\"\n"
            f"Intent: {plan.intent}\n\n"
        )

        if lore_snippets:
            user_prompt += f"Retrieved lore:\n" + "\n".join(f"- {s}" for s in lore_snippets) + "\n\n"
        if note_lines:
            user_prompt += f"Agent perspectives:\n" + "\n".join(f"- {l}" for l in note_lines) + "\n\n"
        if dice_info:
            user_prompt += f"Dice result: {dice_info}\n"
        if state_changes:
            user_prompt += f"State changes this turn:\n{state_changes}\n"

        result = self.llm.complete(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
            max_tokens=2000,
        )

        if not result.used or not result.text:
            return None

        text = result.text.strip().replace('—', ' - ').replace('–', '-')
        delimiter = "---PART TWO---"
        if delimiter in text:
            parts = text.split(delimiter, 1)
            return parts[0].strip(), parts[1].strip()

        mid = len(text) // 2
        split_at = text.rfind(". ", 0, mid) + 1
        if split_at > 0:
            return text[:split_at].strip(), text[split_at:].strip()
        return text, ""

    def _build_choices(self, intent: str, dice_result: dict | None, narration: str = "", last_action: str = "") -> list[str]:
        fallback = self._static_choices(intent, dice_result)
        if not self.llm.available:
            return fallback

        state = self.gm.get_state()
        objectives = [o for o in state.get("objectives", []) if o.get("status") == "active"]
        flags = state.get("world_flags", {})
        location = state.get("location", "unknown")
        party = [{"name": m["name"], "health": m["health"], "max_health": m["max_health"]} for m in state.get("party", [])]

        prompt = (
            "You are a game master assistant. Based on the current game state, suggest 3 short player actions "
            "that would be interesting and meaningful to do NEXT. "
            "Rules:\n"
            "- Each suggestion must be a concrete action (5-10 words), written as if the player is typing it\n"
            "- Do NOT repeat or paraphrase the last action\n"
            "- Vary the types: e.g. one social, one investigative, one bold/combat option\n"
            "- Reflect the current location, active objectives, and what just happened\n"
            "- Return ONLY a JSON array of 3 strings, nothing else"
        )
        context = {
            "location": location,
            "last_action": last_action,
            "what_just_happened": narration[-300:] if narration else "",
            "dice_result": (dice_result or {}).get("result"),
            "active_objectives": [o.get("description", "") for o in objectives[:3]],
            "world_flags": list(flags.keys())[-10:],
            "party_hp": party,
        }

        result = self.llm.complete(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
            ],
            temperature=0.85,
            max_tokens=120,
        )
        if not result.used or not result.text:
            return fallback
        try:
            text = result.text.strip()
            start, end = text.find("["), text.rfind("]")
            if start == -1 or end == -1:
                return fallback
            choices = json.loads(text[start:end+1])
            choices = [c for c in choices if isinstance(c, str) and c.strip()]
            return choices[:3] if len(choices) >= 3 else fallback
        except Exception:
            return fallback

    def _static_choices(self, intent: str, dice_result: dict | None) -> list[str]:
        if dice_result and dice_result.get("result") == "failure":
            return ["Try a more cautious approach.", "Ask the Mage to inspect the scene.", "Find another way in."]
        if intent == "combat":
            return ["Press the attack.", "Hold position and defend.", "Look for an escape route."]
        if intent in {"investigate", "travel", "arcana"}:
            return ["Inspect the next clue.", "Ask a local what they know.", "Move deeper into the area."]
        return ["Ask someone nearby for information.", "Search the area carefully.", "Talk to your party about what to do next."]

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
        player_char = self.gm.state.player_character if hasattr(self.gm, 'state') else ""
        for member in state.get("party", []):
            name = member["agent"]
            if name == player_char or name in processed:
                continue
            if member.get("health", 1) <= 0:
                continue  # dead characters don't speak
            processed.add(name)
            persona = PERSONAS.get(name)
            follow_narration = None
            if self.llm.available:
                char_name = member.get("name", name)
                is_revealed = state.get("world_flags", {}).get("kael_revealed", False)
                if name == "Rival":
                    if is_revealed:
                        identity_desc = f"{char_name}, a villain now exposed as the saboteur behind the Clockwork Plague"
                    else:
                        identity_desc = (
                            f"{char_name}, a cynical smuggler who knows The Sump's back routes. "
                            "You have hidden motives but NEVER hint at them — react like a mercenary, "
                            "not a villain. Do not monologue. Do not say anything that sounds sinister or foreboding."
                        )
                else:
                    identity_desc = f"{char_name}, a {persona.role if persona else 'party member'}"
                prompt = (
                    f"You are {identity_desc} in a fantasy RPG party. "
                    "React briefly to what just happened. "
                    "One short sentence in character, as if speaking to the party.\n"
                )
                context = (
                    f"Player action: {plan.action}\n"
                    f"Current location: {state.get('location', 'unknown')}\n"
                    f"Quest: {state.get('active_quest', 'unknown')}\n"
                )
                if dice_result:
                    context += f"Just rolled: {dice_result['actor']} {dice_result['check']} -> {dice_result['result']}\n"
                if intent := getattr(plan, 'intent', None):
                    context += f"Party intent: {intent}\n"
                result = self.llm.complete(
                    messages=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": context},
                    ],
                    temperature=0.4,
                    max_tokens=600,
                )
                if result.used and result.text:
                    follow_narration = result.text.strip()
            if persona:
                fallback = persona.act_followup(state, plan.intent, outcome)
                if fallback:
                    if not follow_narration:
                        follow_narration = fallback.narration
                    # Always apply HP/state changes (heals, regen) regardless of LLM narration
                    if fallback.state_patch:
                        self.tools.apply_patch(fallback.state_patch)
            if follow_narration:
                followups.append({"agent": name, "narration": follow_narration, "dice": None})
                self.gm.record_trace("agent_followup", {"agent": name, "action": follow_narration})
        return followups

    def pop_intro(self) -> str | None:
        text = self._pending_intro
        self._pending_intro = None
        return text


def build_workflow(gm: GameManager) -> LocalAgentWorkflow:
    """Compatibility hook for a future Agent Framework builder."""
    return LocalAgentWorkflow(gm)
