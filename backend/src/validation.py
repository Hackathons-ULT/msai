from __future__ import annotations

from .state import GameState, PartyMember


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(value, hi))


def validate_and_apply(
    state: GameState,
    *,
    location: str | None = None,
    active_quest: str | None = None,
    health_changes: dict[str, int] | None = None,
    inventory_add: dict[str, list[str]] | None = None,
    inventory_remove: dict[str, list[str]] | None = None,
    flags_set: dict[str, bool | str] | None = None,
    objectives: list[dict] | None = None,
) -> tuple[GameState, list[str]]:
    errors: list[str] = []

    if location is not None:
        state.location = location

    if active_quest is not None:
        state.active_quest = active_quest

    if health_changes:
        for agent, delta in health_changes.items():
            member = state.get_party_member(agent)
            if member is None:
                errors.append(f"Unknown agent: {agent}")
                continue
            new_hp = member.health + delta
            member.health = _clamp(new_hp, 0, member.max_health)
            if member.health == 0:
                errors.append(f"{member.name} is at 0 HP")

    if inventory_add:
        for agent, items in inventory_add.items():
            member = state.get_party_member(agent)
            if member is None:
                errors.append(f"Unknown agent: {agent}")
                continue
            member.inventory.extend(items)

    if inventory_remove:
        for agent, items in inventory_remove.items():
            member = state.get_party_member(agent)
            if member is None:
                errors.append(f"Unknown agent: {agent}")
                continue
            for item in items:
                if item in member.inventory:
                    member.inventory.remove(item)
                else:
                    errors.append(
                        f"{member.name} does not have {item!r} in inventory"
                    )

    if flags_set:
        for key, value in flags_set.items():
            if key in state.world_flags:
                old = state.world_flags[key]
                errors.append(
                    f"Flag {key!r} already set to {old!r}; overwriting to {value!r}"
                )
            state.world_flags[key] = value

    if objectives:
        obj_index = {o["id"]: i for i, o in enumerate(state.objectives)}
        valid_statuses = {"active", "done", "failed", "todo"}
        for update in objectives:
            obj_id = update.get("id")
            if obj_id in obj_index:
                idx = obj_index[obj_id]
                new_status = update.get("status")
                if new_status in valid_statuses:
                    state.objectives[idx] = {**state.objectives[idx], "status": new_status}
            else:
                errors.append(f"Unknown objective id: {obj_id!r}")

    return state, errors
