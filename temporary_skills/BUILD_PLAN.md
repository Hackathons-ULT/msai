# ONBOARDING.md

Role-based onboarding for teammates. When a teammate starts a session (or asks to onboard),
**first identify who you are working with.** Ask which role they hold (see Step 1), then
personalize: show only that role's block plus "Shared essentials". Do not dump the whole file.
Read `AGENTS.md` (authoritative code spec) and `BUILD_PLAN.md` (full team plan) for context
before advising.

---

## Step 1 — Ask the teammate

Ask exactly this, then wait:

> Which role are you on this project?
> 1. AI Lead 1 — Game Master + orchestration
> 2. AI Lead 2 — Foundry IQ + retrieval
> 3. AI Member 3 — World pack, personas, evaluations
> 4. Backend Dev — State, tools, integration
> 5. Frontend Dev — Interface, reasoning trace, demo

If they are unsure, help them pick from the descriptions. Then show only that role's block
below, followed by "Shared essentials (everyone)".

---

## Role blocks

### 1. AI Lead 1 — Game Master + orchestration
**You own the brain of the system: the Game Master agent and the turn loop.** This is where
most of the reasoning score (25%) is earned, so make the orchestration legible.

Your steps (from the build plan): **A3, A4, D1, E1, E2, E3.**

What you build:
- The GM loop: interpret player intent -> select which character agents react -> query Foundry IQ -> call the dice tool -> resolve conflicts -> narrate -> update state.
- The **reasoning trace** emitted every turn (interpret, route, retrieve, roll, narrate, state_update). This is a scored feature; treat it as core.
- The Planner/Executor pattern: GM explicitly plans which agents and tools to invoke before acting.

You depend on: AI Lead 2's `retrieve_lore()` interface, the Backend's dice tool and state store,
the character agent personas (AI Member 3). Coordinate the turn contract (`POST /turn` shape in
AGENTS.md) with Backend and Frontend early.

First action: stand up a single end-to-end turn (E1) against placeholder agents/lore, then grow it.

### 2. AI Lead 2 — Foundry IQ + retrieval
**You own the knowledge/grounding layer.** When any agent asks about the world, it must get the
right lore back **with a citation**. That is the grounding/accuracy score (25%).

Your steps: **B2, B3, B4, and the Mage's retrieval in D2.**

What you build:
- Access smoke test first: confirm Foundry project access + RBAC (`Foundry User` role; a 403 means it is missing) + an Azure AI Search service. Create a throwaway knowledge base, index one small file, query it, confirm a cited chunk returns.
- Ingest the world pack (B2), verify retrieval quality with direct queries for a location, an NPC, the artifact (B3).
- Separate player-known vs GM-only lore (B4).
- Expose `retrieve_lore(query, scope="player"|"gm") -> { chunks, citations }` for the GM and Mage.

You depend on: AI Member 3 delivering a rough world pack. Do not wait for final lore; index a
rough draft so you unblock everyone, improve later.

First action: run the access smoke test (do not discover an access problem on demo day).

### 3. AI Member 3 — World pack, personas, evaluations
**You own the world and the characters' voices.** The world pack is the critical path: Foundry
IQ cannot index until it exists, so start immediately.

Your steps: **B1, the personas in D2, plus D3, D4, and the optional E4/G5.**

What you build:
- The world pack as small, focused, original Markdown files: `world_overview.md` (setting), `main_quest.md` (story/objective/clues/one twist), per-character files or `characters.md`, `rival.md` (GM-only secret), `locations.md`, `factions.md`, `artifact.md`, `bestiary.md`, `homebrew_rules.md`. One file answers one kind of question.
- Distinct agent personas (Warrior, Mage, Rogue, Healer, Rival) that occasionally disagree in character — good drama and good visible reasoning.
- If core lands early: the Critic/Verifier pass (E4) and a small evaluation set for story consistency and rule correctness (G5).

Constraints: **synthetic and original only** — no real names, no copyrighted settings or
characters. Plain ASCII, no em dashes.

First action: draft a rough `world_overview.md` + `main_quest.md` + one location, and hand them
to AI Lead 2 so indexing can start.

### 4. Backend Dev — State, tools, integration
**You are the pipe and the state store, not the game logic.** The agents decide what happens;
you route the action, run the tools the GM calls, persist state, return the result.

Your steps: **A2, C1, C2, C3, G2, and optional H1.**

What you build:
- Repo/env hygiene (A2): venv, `.gitignore` with `.venv/` and `.env`, secrets never committed (G2).
- The shared **state object** (C1): single JSON source of truth (`campaign, location, active_quest, party[], world_flags`), separate from static lore.
- The **dice tool** (C2): rolls, compares to difficulty, returns `{ actor, check, roll, difficulty, result, consequence }`.
- State update + validation (C3): clean apply path, no double-applied flags.
- The `POST /turn` endpoint: `{ action, session_id }` in; `{ narration, choices, state, trace }` out. It hands the action to the GM and executes tools the GM invokes — it does **not** decide outcomes.

Note: the world pack never flows through you. It is uploaded once into Foundry IQ and queried by
agents. Runtime traffic is only the player action in, scene + state out.

First action: scaffold the `/turn` endpoint + state store + dice tool against a stub GM.

### 5. Frontend Dev — Interface, reasoning trace, demo
**You make the reasoning visible.** A plain UI that clearly shows the agents thinking beats a
fancy UI that hides it.

Your steps: **F1, F2, F3, F4, and the demo/docs H2, H3.**

What you build:
- A chat interface (F1): narration + the player's choices. Clear, not fancy.
- The **reasoning-trace panel** (F2): shows the GM routing to agents, querying Foundry IQ, rolling dice. This most directly lifts the 25% reasoning score — core, not decoration. Render the `trace` array returned by `POST /turn`.
- A grounded moment (F3): surface a citation / retrieved-lore snippet so grounding is visible.
- Optional polish (F4): theming, a one-time banner/crest (a setup-time generator, not a live agent), agent cards.
- The README (H2) and demo video (H3) — both scored.

You depend on: the `POST /turn` contract (AGENTS.md). Agree it with Backend/AI Lead 1 before building.

First action: build the chat + trace panel against a mocked `/turn` response, then wire to the real one.

---

## Shared essentials (everyone)

- **Build approach is locked: local Microsoft Agent Framework.** Foundry provides models + Foundry IQ; the loop runs in our code.
- **Synthetic data only.** No real names, no PII, no copyrighted lore. Everything original.
- **No secrets in the repo.** `.env` and `.venv/` are gitignored. Scan before pushing.
- **Plain ASCII, no em dashes** in generated text and docs.
- **The two biggest scorers** are visible orchestration (the reasoning trace) and grounded retrieval with citations. When in doubt, protect those.
- **Authoritative contracts** (turn endpoint, state, dice, trace) live in `AGENTS.md`. Build against them so the pieces fit.
- When unsure about a Foundry/Azure API detail, check current Microsoft Learn docs rather than guessing — Foundry IQ is days-old GA and some features are preview/version-gated.