# Agents League - Multi-Agent AI RPG

A browser-based fantasy RPG where every party member is an autonomous AI agent. You type an action; the AI Game Master orchestrates five specialist agents, retrieves world lore from Azure Foundry IQ, rolls dice, and narrates a living story in real time.

---

## What It Does

You play as an adventurer in **Aethelgard** - a decaying steampunk city choked by the **Clockwork Plague**, a contagion of corrupted machinery spreading from a sabotaged pressure core deep in The Sump. Your mission: find who caused it and stop it.

Every turn you type an action (e.g. *"I interrogate the guard about the Pressure Core"*). The system:

1. **Classifies your intent** (combat, investigation, social, arcana, stealth)
2. **Retrieves relevant lore** from Azure Foundry IQ (world facts, locations, character backgrounds)
3. **Consults each agent** — Warrior, Mage, Healer, Bard each give a specialist perspective
4. **Rolls a D20** if the action is risky (success/partial/failure changes the outcome)
5. **Narrates the result** as a full scene grounded in the retrieved lore
6. **Each agent responds** in character with their own follow-up action

---

## Agent Architecture

| Agent | Role | Notes |
|---|---|---|
| **Game Master** | Orchestrator | Classifies intent, routes to agents, calls tools, narrates. Owns the reasoning trace. |
| **Warrior (Jax)** | Combat & strength | Handles melee, intimidation, physical checks. Player-pickable. |
| **Mage (Lyra)** | Arcane & investigation | Pulls lore from Foundry IQ. Handles magic, runes, artifact knowledge. Player-pickable. |
| **Healer (Bram)** | Support & negotiation | Party health, morale, ethical options, cultural lore. Player-pickable. |
| **Bard (Seren)** | Social & persuasion | Manipulation, inspiration, reading the room. Player-pickable. |
| **Rival (Kael)** | AI-controlled antagonist | Secret villain. True motive stored only in `kb-gm-secrets` (GM scope). Never player-pickable. |

---

## Reasoning Trace

Every turn emits a full reasoning trace visible in the **[T] TRACE** panel:

- GM intent classification
- Which agents were consulted and what they suggested
- Foundry IQ retrieval — what lore chunks were fetched and from which knowledge base
- Dice roll details (actor, check type, DC, roll, modifier, result, consequence)
- State updates (location changes, HP changes, world flags set)

This is the core scored feature — it makes the AI's decision-making visible and auditable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Azure OpenAI (`gpt-oss-120b`) via Azure AI Foundry |
| **Retrieval** | Azure AI Search — hybrid retrieval (vector + keyword) via Foundry IQ |
| **Knowledge Bases** | `knowledgebaseforrpggame` (player lore) + `kb-gm-secrets` (GM-only secrets) |
| **Backend** | Python 3.9+, FastAPI, uvicorn |
| **Agent Framework** | Custom multi-agent orchestration (GM planner, dice engine, state manager, per-agent personas) |
| **Frontend** | Vanilla JS, retro pixel art UI, Web Audio API for SFX |
| **State** | In-memory JSON — party HP, inventory, location, world flags, reasoning trace |

---

## Knowledge Base Structure

All world content is **original synthetic fiction** — no real-world names, no copyrighted settings.

```
knowledge_base/
  world_overview.md       # Aethelgard geography, factions, history
  homebrew_rules.md       # D20 system, DC thresholds, stat modifiers
  characters/
    warrior.md            # Jax — background, personality, combat style
    mage.md               # Lyra — arcane expertise, lore focus
    healer.md             # Bram — field medic, negotiator
    bard.md               # Seren — performer, social manipulator
    rogue.md              # Kael — surface persona only; true motive in GM_only/
  GM_only/
    main_quest.md         # The real antagonist and sabotage plan (never shown to player)
    gm_directives.md      # How the GM should escalate tension and protect secrets
```

Two-tier retrieval: the GM queries `knowledgebaseforrpggame` for player-facing lore and `kb-gm-secrets` for hidden plot facts. The secret knowledge never appears in the narration directly.

---

## Running Locally

**Requirements:** Python 3.9+, a `.env` file with Azure credentials (see below).

```bash
# 1. Install backend dependencies
cd backend
pip install -r requirements.txt

# 2. Start the backend
uvicorn server:app --reload

# 3. Serve the frontend (separate terminal)
cd frontend/src
python -m http.server 3000

# 4. Open http://localhost:3000/landing.html
```

**`.env` file** (in project root, never committed):

```
AZURE_SEARCH_ENDPOINT=https://<your-search-resource>.search.windows.net
AZURE_SEARCH_KEY=<your-search-key>
PLAYER_KB=knowledgebaseforrpggame
GM_KB=kb-gm-secrets
AZURE_AI_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com/api/projects/<project-name>
AZURE_AI_API_KEY=<your-api-key>
AZURE_AI_MODEL_DEPLOYMENT=gpt-oss-120b
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/reset` | Start a new game with a custom party and campaign |
| `POST` | `/turn` | Submit a player action — returns narration, dice, followups, state, trace |
| `GET` | `/state` | Current game state (party, location, quest, world flags) |
| `GET` | `/trace` | Full reasoning trace for the current session |
| `GET` | `/intro` | Pending intro narration (generated on reset) |
| `GET` | `/character-types` | Available player classes |

---

## How to Play

| Input | What happens |
|---|---|
| Type any action + ACT | GM narrates the outcome |
| Risky action | D20 rolled automatically — high = good, low = bad |
| Click a highlighted word | Auto-asks "Tell me more about X" |
| [T] TRACE | See the full AI reasoning chain |
| [S] RECAP | Full session dialogue history |
| [W] LORE | World overview for Aethelgard |

---

## Security Notes

- All secrets in `.env` — gitignored, never committed
- All world content is original synthetic fiction — no PII, no copyrighted material
- Kael's true motive exists only in `kb-gm-secrets` — never injected into player-facing prompts
- Keys should be rotated after the submission deadline

---

*Built for the Microsoft AI Agents Hackathon — June 2026*
