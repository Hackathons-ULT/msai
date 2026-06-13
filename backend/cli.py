#!/usr/bin/env python3
"""CLI game runner for testing the backend without a frontend."""

from src.game_manager import GameManager
from src.state import GameState, PartyMember


def print_banner():
    print("=" * 50)
    print("  MSAI RPG — Backend Test Runner")
    print("=" * 50)
    print("Commands:")
    print("  roll <actor> <check> <dc> [mod]   Roll a d20 check")
    print("  damage <actor> <amt>              Deal damage to a party member")
    print("  heal <actor> <amt>                Heal a party member")
    print("  give <actor> <item>               Add item to inventory")
    print("  take <actor> <item>               Remove item from inventory")
    print("  goto <location>                   Move to a new location")
    print("  quest <text>                      Set the active quest")
    print("  flag <key> <value>                Set a world flag")
    print("  narrate <text>                    Add narration (no state change)")
    print("  state                             Show current game state")
    print("  trace                             Show reasoning trace")
    print("  clear                             Clear trace")
    print("  quit                              Exit")
    print("=" * 50)


def main():
    gm = GameManager(
        state=GameState(
            campaign="The Lost Sigil",
            location="Whispering Woods",
            active_quest="Find the ancient artifact",
            party=[
                PartyMember(agent="Warrior", name="Thorn", health=20),
                PartyMember(agent="Mage", name="Elara", health=16, inventory=["Staff"]),
                PartyMember(agent="Rogue", name="Vex", health=18, inventory=["Dagger", "Lockpicks"]),
                PartyMember(agent="Healer", name="Luna", health=14, inventory=["Herbs"]),
            ],
        )
    )

    print_banner()

    while True:
        try:
            raw = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not raw:
            continue

        parts = raw.split()
        cmd = parts[0].lower()

        if cmd == "quit":
            break

        elif cmd == "roll":
            if len(parts) < 4:
                print("Usage: roll <actor> <check> <dc> [mod]")
                continue
            actor = parts[1]
            check = parts[2]
            try:
                dc = int(parts[3])
            except ValueError:
                print("DC must be a number")
                continue
            mod = int(parts[4]) if len(parts) > 4 else 0
            result = gm.roll_dice(actor, check, dc, mod)
            status = "✅" if result["result"] == "success" else "❌"
            print(f"  {status} {actor} rolls {check}: {result['total']} vs DC {dc} ({result['result']})")
            print(f"     → {result['consequence']}")

        elif cmd == "damage":
            if len(parts) < 3:
                print("Usage: damage <actor> <amount>")
                continue
            actor = parts[1]
            try:
                amt = int(parts[2])
            except ValueError:
                print("Amount must be a number")
                continue
            errs = gm.update(health_changes={actor: -amt})
            member = gm.state.get_party_member(actor)
            if member:
                print(f"  {actor} takes {amt} damage (HP: {member.health}/{member.max_health})")
            if errs:
                for e in errs:
                    print(f"  ⚠ {e}")

        elif cmd == "heal":
            if len(parts) < 3:
                print("Usage: heal <actor> <amount>")
                continue
            actor = parts[1]
            try:
                amt = int(parts[2])
            except ValueError:
                print("Amount must be a number")
                continue
            errs = gm.update(health_changes={actor: amt})
            member = gm.state.get_party_member(actor)
            if member:
                print(f"  {actor} heals {amt} (HP: {member.health}/{member.max_health})")
            if errs:
                for e in errs:
                    print(f"  ⚠ {e}")

        elif cmd == "give":
            if len(parts) < 3:
                print("Usage: give <actor> <item>")
                continue
            actor = parts[1]
            item = " ".join(parts[2:])
            errs = gm.update(inventory_add={actor: [item]})
            print(f"  {actor} receives: {item}")
            if errs:
                for e in errs:
                    print(f"  ⚠ {e}")

        elif cmd == "take":
            if len(parts) < 3:
                print("Usage: take <actor> <item>")
                continue
            actor = parts[1]
            item = " ".join(parts[2:])
            errs = gm.update(inventory_remove={actor: [item]})
            print(f"  {actor} loses: {item}")
            if errs:
                for e in errs:
                    print(f"  ⚠ {e}")

        elif cmd == "goto":
            if len(parts) < 2:
                print("Usage: goto <location>")
                continue
            loc = " ".join(parts[1:])
            gm.update(location=loc)
            print(f"  Moved to: {loc}")

        elif cmd == "quest":
            if len(parts) < 2:
                print("Usage: quest <text>")
                continue
            q = " ".join(parts[1:])
            gm.update(active_quest=q)
            print(f"  Quest set: {q}")

        elif cmd == "flag":
            if len(parts) < 3:
                print("Usage: flag <key> <value>")
                continue
            key = parts[1]
            val = " ".join(parts[2:])
            if val.lower() in ("true", "false"):
                val = val.lower() == "true"
            errs = gm.update(flags_set={key: val})
            print(f"  Flag {key} = {val}")
            if errs:
                for e in errs:
                    print(f"  ⚠ {e}")

        elif cmd == "narrate":
            if len(parts) < 2:
                print("Usage: narrate <text>")
                continue
            text = " ".join(parts[1:])
            gm.update(narration=text)
            print(f"  📖 {text}")

        elif cmd == "state":
            s = gm.get_state()
            print(f"  Campaign: {s['campaign']}")
            print(f"  Location: {s['location']}")
            print(f"  Quest: {s['active_quest']}")
            print("  Party:")
            for m in s["party"]:
                inv = ", ".join(m["inventory"]) if m["inventory"] else "empty"
                print(f"    {m['agent']:8} {m['name']:6} HP: {m['health']:2}/{m['max_health']:2} [{inv}]")
            print(f"  Flags: {s['world_flags']}")

        elif cmd == "trace":
            trace = gm.get_trace()
            if not trace:
                print("  (empty)")
            for i, entry in enumerate(trace, 1):
                t = entry["type"]
                if t == "dice":
                    print(f"  {i}. 🎲 {entry['actor']} {entry['check']}: {entry['total']} vs DC {entry['difficulty']} → {entry['result']}")
                elif t == "state_update":
                    changes = []
                    if entry["location"]:
                        changes.append(f"loc={entry['location']}")
                    if entry["active_quest"]:
                        changes.append(f"quest={entry['active_quest']}")
                    if entry["health_changes"]:
                        changes.append(f"hp={entry['health_changes']}")
                    if entry["inventory_add"]:
                        changes.append(f"give={entry['inventory_add']}")
                    if entry["inventory_remove"]:
                        changes.append(f"take={entry['inventory_remove']}")
                    if entry["flags_set"]:
                        changes.append(f"flags={entry['flags_set']}")
                    print(f"  {i}. 📦 {', '.join(changes)}")
                elif t == "narration":
                    print(f"  {i}. 📖 {entry['text']}")
                else:
                    print(f"  {i}. {entry}")

        elif cmd == "clear":
            gm.clear_trace()
            print("  Trace cleared")

        else:
            print(f"  Unknown command: {cmd}")

    print("\nGoodbye!")


if __name__ == "__main__":
    main()
