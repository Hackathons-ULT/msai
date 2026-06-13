# CLAUDE.md

Project context for Claude Code. Read this fully before generating or editing code.

---

## What this project is

A turn-based fantasy role-play game built for the **Microsoft Agents League hackathon, Reasoning Agents track**. It is a **multi-agent system on Microsoft Foundry**.

One human player types actions in natural language. A **Game Master (GM) agent** orchestrates the turn: it interprets the player's intent, routes to the relevant **character agents** (party members), retrieves world lore from **Foundry IQ**, resolves dice rolls via a tool, updates shared game state, and narrates the next scene. Every party member except the human is an AI agent. The GM is also an AI agent and is the only orchestrator.

The world (locations, characters, quest, lore) is **original and synthetic**, stored in Foundry IQ as a knowledge base, and retrieved at runtime so narration stays grounded and consistent.

### Hard requirements (non-negotiable)
- Multi-agent system, built with the **Microsoft Agent Framework (local/code-based orchestration)**, calling Foundry-hosted models and Foundry IQ.
- Visible multi-step reasoning across agents (the reasoning trace is a scored feature, not decoration).
- Integrates **Foundry IQ** as the knowledge/grounding layer (this is our chosen Microsoft IQ layer).
- **Synthetic data only.** No real names, no PII, no copyrighted settings or characters. Everything original.
- No secrets in the repo. `.env` is gitignored. Never commit keys, endpoints with keys, or connection strings.

### Build approach (LOCKED)
**Local orchestration with the Microsoft Agent Framework.** The agent loop runs in our own Python code, not as a Foundry-hosted/cloud-orchestrated service. Foundry still provides the hosted **models** and **Foundry IQ** (knowledge layer); we call both from local code. This is chosen for fast iteration, easy debugging, and because the reasoning trace is far simpler to emit when the loop runs in our code. Deploying to Foundry Agent Service later is an optional finishing step (H1), not the foundation - do not build around cloud hosting.

### What scores (so prioritize accordingly)
Reasoning & multi-step thinking (25%), Accuracy & relevance / grounding (25%), Reliability & safety (20%), Creativity (15%), UX/presentation (15%). The two biggest levers are **visible orchestration** and **grounded retrieval with citations**.

---

## Architecture

```
Player action (string)
   -> Frontend  (chat UI + reasoning-trace panel)
   -> Backend   (one turn endpoint; routes + holds state; runs tools the GM calls)
   -> GM agent  (interpret intent -> select character agents -> query Foundry IQ -> roll dice -> narrate -> update state)
        -> Character agents: Warrior, Mage, Rogue, Healer, Rival
        -> Foundry IQ knowledge base (world lore retrieval, with citations)
        -> Dice tool (structured roll result)
   -> Narrated scene + updated state (back to frontend)
```

Key principle: **the agents decide what happens, not backend logic.** The backend is a pipe and a state store. It receives the action, hands it to the GM, executes tools the GM invokes, persists state, and returns the result. Game outcomes (including rejecting an absurd action) are the GM's reasoning, not hardcoded rules.

The world pack files are **never** passed through the frontend or backend at runtime. They are uploaded once into Foundry IQ and queried by agents. Runtime traffic is only: player action in, narrated scene + state out.

### Agents
- **Game Master** - orchestrator. Intent classification, agent routing, tool sequencing, conflict resolution, narration, state updates. Owns the reasoning trace.
- **Warrior** - combat, defense, strength/intimidation checks.
- **Mage** - interprets magic/runes/artifacts; pulls arcane lore from Foundry IQ.
- **Rogue** - scouting, traps, stealth/lockpicking; recalls secrets from state.
- **Healer** - party health, morale, negotiation/ethical options, cultural lore.
- **Rival** - recurring ally-or-antagonist driven by player choices; its secret motive is GM-only.

---

## Contracts (all code must conform to these shapes)

### Turn endpoint
One endpoint drives a turn. Player action in, scene + updated state out.
```
POST /turn
request:  { "action": "<player action string>", "session_id": "<id>" }
response: {
  "narration": "<the next scene, player-facing>",
  "choices": ["<suggested next action>", ...],
  "state": { ...updated game state... },
  "trace": [ ...reasoning trace steps... ]   // see below
}
```

### Shared game state (single source of truth; static lore stays in Foundry IQ, not here)
```json
{
  "campaign": "<name>",
  "location": "<current location>",
  "active_quest": "<quest>",
  "party": [
    { "agent": "Warrior", "name": "...", "health": 22, "inventory": ["..."] }
  ],
  "world_flags": { "gate_sigil_discovered": true, "rival_trust_level": "uncertain" }
}
```

### Dice result (returned by the dice tool)
```json
{ "actor": "Rogue", "check": "Stealth", "roll": 17, "difficulty": 14,
  "result": "success", "consequence": "<short narration hook>" }
```
`result` is one of: `success`, `partial`, `failure`.

### Reasoning trace (this is a scored feature - emit it every turn)
An ordered list of what the GM did, so the UI can show the multi-step reasoning:
```json
[
  { "step": "interpret", "detail": "classified intent as investigation" },
  { "step": "route", "detail": "asked Rogue (traps), Mage (magic residue)" },
  { "step": "retrieve", "detail": "Foundry IQ query 'Moonlit Gate'", "citations": ["locations.md"] },
  { "step": "roll", "detail": { "actor": "Rogue", "check": "Perception", "roll": 15, "difficulty": 12, "result": "success" } },
  { "step": "narrate", "detail": "composed scene from agent inputs + lore + roll" },
  { "step": "state_update", "detail": "set world_flags.gate_sigil_discovered = true" }
]
```

---

## Foundry IQ - retrieval layer (ACTIVE WORK for this contributor)

This contributor (AI Lead 2) owns the knowledge/grounding layer. Foundry IQ is built on Azure AI Search agentic retrieval; a knowledge base is created and agents query it for grounded, cited answers. Goal: when an agent asks about a location/NPC/artifact, it gets back the right lore chunk **with a citation**.

### Build order for this slice
1. **Access smoke test.** Confirm Foundry project access, correct RBAC (the `Foundry User` role on the parent resource; a 403 means the role is missing), and an Azure AI Search service exists. Create a throwaway knowledge base, connect one small file, index, query, confirm a cited chunk returns. Prefer the Serverless/Developer tier for cost.
2. **Ingest the world pack** (authored separately as multiple small, focused Markdown files - see below). Create the real knowledge base from them.
3. **Verify retrieval quality.** Direct queries for a location, a character, and the artifact must each return the correct chunk with a citation. If results are vague, split lore into smaller files / tighten headings. Do not proceed until retrieval is clean.
4. **Separate player-known vs GM-only lore** so the GM can reason over secrets/twists without leaking them into player-facing narration.
5. **Expose a retrieval interface** the GM and Mage call. Foundry IQ knowledge bases are reachable via the knowledge-base API and as an MCP server, so any agent runtime can query them.

### Retrieval interface (what other agents call)
Provide a clean function the GM/Mage use:
```
retrieve_lore(query: str, scope: "player" | "gm" = "player") -> { "chunks": [...], "citations": [...] }
```
- `scope="player"` excludes GM-only secret lore.
- Always return citations (source filename) so the trace and UI can show grounding.

### World pack file layout (authored by another contributor; this slice ingests it)
Small, focused, single-topic Markdown files retrieve best. Expected set:
`world_overview.md` (setting), `main_quest.md` (story/objective/clues/twist), `characters.md` or per-character files (`warrior.md`, `mage.md`, `rogue.md`, `healer.md`), `rival.md` (GM-only secret), `locations.md`, `factions.md`, `artifact.md`, `bestiary.md`, `homebrew_rules.md` (actions/rules). One file answers one kind of question.

---

## Tech / environment
- Python 3.10+. **Microsoft Agent Framework** for local orchestration. Foundry-hosted models + Azure AI Search (for Foundry IQ) accessed from local code.
- `.env` holds `AZURE_AI_PROJECT_ENDPOINT`, `AZURE_AI_MODEL_DEPLOYMENT` (e.g. a gpt-4 class model), and Azure AI Search service details. `.env` and `.venv/` are gitignored.
- Note: Foundry IQ went GA at Build 2026 and some agentic-retrieval features are preview-gated by API version. Verify exact API versions / SDK calls against current Microsoft Learn docs before relying on a specific signature; do not invent endpoints or version strings.

## Conventions
- Keep the GM's orchestration legible - emit the reasoning trace every turn.
- Keep mutable session state separate from static world lore.
- Plain ASCII in generated text and docs; no em dashes.
- Synthetic data only; if asked to add lore, invent original content, never reference existing franchises.
- When unsure about a Foundry/Azure API detail, say so and check docs rather than guessing.