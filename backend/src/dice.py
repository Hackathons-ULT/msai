from __future__ import annotations

import random

_CONSEQUENCE_HOOKS: dict[str, list[str]] = {
    "success": [
        "{actor} pulls it off cleanly.",
        "A stroke of luck: {actor} succeeds.",
        "{actor}'s skill shines through.",
        "The dice favour {actor}.",
    ],
    "partial": [
        "{actor} manages, but barely.",
        "{actor} gets partway there.",
        "Close. {actor} almost had it.",
        "{actor} scrapes by with a partial result.",
    ],
    "failure": [
        "{actor} stumbles at the worst moment.",
        "The odds catch up to {actor}.",
        "Not {actor}'s finest moment.",
        "Bad luck. {actor} fails.",
    ],
}


def roll_d20(
    actor: str,
    check: str,
    difficulty: int,
    modifier: int = 0,
) -> dict:
    raw = random.randint(1, 20)
    total = raw + modifier

    if total >= difficulty + 5:
        result = "success"
    elif total >= difficulty - 4:
        result = "partial"
    else:
        result = "failure"

    hooks = _CONSEQUENCE_HOOKS[result]
    hook = random.choice(hooks).format(actor=actor)

    return {
        "actor": actor,
        "check": check,
        "roll": raw,
        "modifier": modifier,
        "total": total,
        "difficulty": difficulty,
        "result": result,
        "consequence": hook,
    }
