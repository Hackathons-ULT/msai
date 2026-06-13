from __future__ import annotations

from state import GameState
from dice import roll_d20
from validation import validate_and_apply


class GameManager:
    def __init__(self, state: GameState | None = None):
        self.state = state or GameState()
        self.trace: list[dict] = []

    def roll_dice(
        self,
        actor: str,
        check: str,
        difficulty: int,
        modifier: int = 0,
    ) -> dict:
        result = roll_d20(actor, check, difficulty, modifier)
        self.trace.append(
            {
                "type": "dice",
                "actor": actor,
                "check": check,
                "roll": result["roll"],
                "modifier": modifier,
                "total": result["total"],
                "difficulty": difficulty,
                "result": result["result"],
            }
        )
        return result

    def update(
        self,
        *,
        location: str | None = None,
        active_quest: str | None = None,
        health_changes: dict[str, int] | None = None,
        inventory_add: dict[str, list[str]] | None = None,
        inventory_remove: dict[str, list[str]] | None = None,
        flags_set: dict[str, bool | str] | None = None,
        narration: str | None = None,
    ) -> list[str]:
        has_state_change = any(
            x is not None
            for x in [location, active_quest, health_changes, inventory_add, inventory_remove, flags_set]
        )

        errors: list[str] = []
        if has_state_change:
            self.state, errors = validate_and_apply(
                self.state,
                location=location,
                active_quest=active_quest,
                health_changes=health_changes,
                inventory_add=inventory_add,
                inventory_remove=inventory_remove,
                flags_set=flags_set,
            )
            self.trace.append(
                {
                    "type": "state_update",
                    "location": location,
                    "active_quest": active_quest,
                    "health_changes": health_changes,
                    "inventory_add": inventory_add,
                    "inventory_remove": inventory_remove,
                    "flags_set": flags_set,
                }
            )

        if narration:
            self.trace.append({"type": "narration", "text": narration})

        return errors

    def get_state(self) -> dict:
        return self.state.to_dict()

    def get_trace(self) -> list[dict]:
        return list(self.trace)

    def clear_trace(self) -> None:
        self.trace.clear()
