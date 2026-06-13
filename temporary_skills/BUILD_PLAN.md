# Challenge B Build Plan — Multi-Agent RPG (Reasoning Agents Track)

This is the full team plan and priority reference for the Agents League hackathon entry.
For the code-level spec and active work, see `AGENTS.md` in the repo root. This document
is the human-coordination layer: scope, sequencing, ownership, and submission.

Priority tags used throughout:
- **IMPORTANT** — core; submission is invalid or weak without it.
- **RECOMMENDED** — strongly lifts the score; do unless blocked.
- **OPTIONAL** — polish or bonus; add after the core is solid.

> One rule above all: **Foundry IQ retrieval must be live early.** It is a dependency for
> the Game Master. Get a rough world pack uploaded and indexed before building the
> orchestration loop, so the agents have something real to retrieve from.

---

## 1. What we are building

A turn-based fantasy RPG. The player types an action. A **Game Master agent** interprets it,
decides which **character agents** react, retrieves world lore from **Foundry IQ**, resolves
dice rolls through a tool, updates a shared game state, and narrates the next scene. The world
is original and synthetic. Full scope: Game Master plus five character agents (Warrior, Mage,
Rogue, Healer, Rival), Foundry IQ grounding, dice and state tools, a visible reasoning trace,
and the valued extras where they fit.

Build approach is **locked to local orchestration with the Microsoft Agent Framework**;
Foundry provides hosted models + Foundry IQ.

---

## 2. The competition

**Hard requirements:** multi-agent system aligned to Challenge B; built with the Microsoft
Agent Framework (local) calling Foundry models + Foundry IQ; visible multi-step reasoning;
at least one Microsoft IQ layer (Foundry IQ); synthetic data only; demoable with clear agent
interactions; public GitHub repo with a README covering agents/orchestration/tools/data; a
demo video.

**Rubric (drives the priority tags):**

| Criterion | Weight | Measures |
|---|---|---|
| Reasoning & Multi-step Thinking | 25% | Visible decomposition, planning, agent collaboration |
| Accuracy & Relevance | 25% | Matches scenario; grounded, relevant outputs |
| Reliability & Safety | 20% | Robust patterns, clean data/tool hygiene, safe edge cases |
| Creativity & Originality | 15% | Original world and execution |
| User Experience & Presentation | 15% | Clear, polished, demoable |

Reasoning + Accuracy are half the score. Anything that makes orchestration visible or grounds
narration in Foundry IQ is IMPORTANT; anything that only adds shine is OPTIONAL.

---

## 3. Why Foundry IQ (and not the others)

| IQ layer | What it is | Decision |
|---|---|---|
| Foundry IQ | Unified grounding layer: upload docs, get cited retrieval. RAG-as-a-service. | Use it. Core. |
| Work IQ | Microsoft 365 work-context (calendar, mail). APIs reported to land June 16, 2026. | Skip. Irrelevant to an RPG. |
| Fabric IQ | Semantic ontology over Microsoft Fabric. | Skip. Heavy setup, no payoff here. |

Verify Work IQ dates and exact Foundry IQ API details against Microsoft's own docs before
relying on them; these come from recent Build 2026 reporting.

---

## 4. The build, in order

Do these top to bottom. Tags mark core vs additive. Parallelism noted where it matters.

### Phase A: Foundation
- **A1. Accounts and access** — IMPORTANT — GitHub repo, Azure subscription (Azure for Students if eligible), Discord. Confirm Foundry access works.
- **A2. Repo and environment** — IMPORTANT — git init, Python 3.10+ venv, `.gitignore` with `.venv/` and `.env` before first commit.
- **A3. Foundry project + model** — IMPORTANT — create project, deploy a model, put endpoint + deployment name in `.env`.
- **A4. Build approach** — IMPORTANT — **LOCKED: local Microsoft Agent Framework.** Everyone builds against this.

### Phase B: Grounding (start in parallel with A)
- **B1. Draft the world pack** — IMPORTANT — original synthetic world as small focused Markdown files (overview, location, main quest with one twist, per-character profiles, rival secret, factions, artifact, monster, rules).
- **B2. Upload to Foundry IQ and index** — IMPORTANT — create the knowledge base early; indexing takes time; rough pack unblocks downstream.
- **B3. Verify retrieval quality** — IMPORTANT — direct queries for a location, an NPC, the artifact must return the right chunk with citations before wiring agents.
- **B4. Mark player-known vs secret lore** — RECOMMENDED — so the GM does not leak twists.

### Phase C: Core mechanics
- **C1. Shared state object** — IMPORTANT — single JSON source of truth; separate from static lore.
- **C2. Dice tool** — IMPORTANT — rolls, compares to difficulty, returns structured result.
- **C3. State update + validation** — RECOMMENDED — clean apply path with sanity checks.

### Phase D: Agents
- **D1. Game Master agent** — IMPORTANT — orchestrator; bulk of the reasoning score.
- **D2. Warrior, Mage, Rogue agents** — IMPORTANT — three workhorse personas, one clear job each; Mage pulls lore from Foundry IQ.
- **D3. Healer and Rival agents** — RECOMMENDED — complete the cast, add narrative depth.
- **D4. Persona tuning** — RECOMMENDED — distinct personalities that occasionally disagree in character.

### Phase E: Orchestration loop
- **E1. Wire the full turn** — IMPORTANT — get one full turn working end to end first.
- **E2. Build one complete adventure slice** — IMPORTANT — arrive, investigate, hit the twist, resolve. This is what the demo plays through.
- **E3. Planner / Executor + role specialisation** — RECOMMENDED — GM explicitly plans agents/tools before acting.
- **E4. Critic / Verifier pass** — OPTIONAL — check narration is consistent with state and lore.

### Phase F: Interface and reasoning trace
- **F1. Chat interface** — IMPORTANT — clear, not fancy.
- **F2. Visible reasoning trace** — IMPORTANT — shows GM routing, IQ queries, dice. Most directly lifts the 25% reasoning score. Core, not decoration.
- **F3. Show a grounded moment** — RECOMMENDED — surface a citation / retrieved snippet.
- **F4. Visual polish** — OPTIONAL — theming, banner/crest, agent cards. The one-time theme generator idea lives here (a setup-time tool, not a live agent).

### Phase G: Hardening and safety
- **G1. Edge-case handling** — IMPORTANT — nonsense asks for clarification; no-lore narrates gracefully; absurd actions fail cleanly; repeats keep state consistent.
- **G2. Secrets and data hygiene** — IMPORTANT — `.env` gitignored, scan for secrets, all data synthetic/fictional, no PII or copied lore.
- **G3. Guardrails and AI transparency** — RECOMMENDED — input/output guardrails; agents stay in character; player knows it's AI.
- **G4. Human-in-the-loop confirmation** — OPTIONAL — confirm major irreversible actions.
- **G5. Evaluation set** — OPTIONAL — test scenarios for story consistency and rule correctness.

### Phase H: Deployment, docs, submission
- **H1. Hosted deployment** — OPTIONAL — Foundry Agent Service for a production story; skip if core is shaky.
- **H2. README** — IMPORTANT — agent roles, orchestration flow, tools, data sources, explicit synthetic-data statement. Scored deliverable.
- **H3. Demo video** — IMPORTANT — playthrough exposing the trace, a grounded moment, one edge case handled.
- **H4. Final submission** — IMPORTANT — read Disclaimer, follow Code of Conduct, repo public with README, submit before the deadline.
- **H5. Community vote** — OPTIONAL — share in Discord; the poll is 10% of the score.

---

## 5. Who owns what (5 members)

Three AI-leaning members, one backend, one frontend. The third AI person (newest) takes the
world pack, persona tuning, and the evaluation/critic layer: real scorable work that does not
collide with the two leads on orchestration and Foundry IQ.

| Member | Owns | Leads |
|---|---|---|
| AI Lead 1 | Game Master + orchestration | A3, A4, D1, E1, E2, E3 |
| AI Lead 2 | Foundry IQ + retrieval | B2, B3, B4, D2 (Mage retrieval) |
| AI Member 3 (newer) | World pack, personas, evals | B1, D2 personas, D3, D4, E4, G5 |
| Backend Dev | State, tools, integration, deploy | A2, C1, C2, C3, G2, H1 |
| Frontend Dev | Interface, trace, demo, docs | F1, F2, F3, F4, H2, H3 |

World pack (B1) is the critical path: Foundry IQ cannot index until it exists. Start it
immediately so AI Lead 2 can upload as soon as a rough draft lands.

---

## 6. Demo video shot order

1. Open on a real player action and its narrated result — reads as a real game in seconds.
2. Expose the trace: GM routing to agents, querying Foundry IQ, rolling dice.
3. Show one grounded moment where retrieved lore visibly shapes the narration.
4. Show one edge case handled gracefully, to evidence reliability.
5. Close on the originality of the world and one line on the architecture.

> The winning move: build one complete adventure slice, ground it hard in Foundry IQ, make the
> agents' reasoning visible, keep the data clean and the demo legible. Depth and clarity beat
> feature count under this rubric.

---

## 7. Quick reference: data shapes

See `AGENTS.md` for the authoritative contracts. Summary:

- **Turn endpoint:** `POST /turn` — `{ action, session_id }` in; `{ narration, choices, state, trace }` out.
- **Shared state:** `{ campaign, location, active_quest, party[{agent,name,health,inventory}], world_flags }`.
- **Dice result:** `{ actor, check, roll, difficulty, result, consequence }`, `result` in {success, partial, failure}.
- **Reasoning trace:** ordered steps (interpret, route, retrieve+citations, roll, narrate, state_update) emitted every turn.n