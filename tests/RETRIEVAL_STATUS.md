# Retrieval layer (Foundry IQ) -- DONE, ready to wire into agents

## Status
Knowledge bases are built, indexed, and tested. Retrieval returns correct,
cited lore. Player-vs-GM secret separation works. This is the grounding layer
the agents call.

## Two knowledge bases (intentional split)
- `knowledgebaseforrpggame` -- PLAYER-FACING lore: world, main quest, party
  characters, homebrew rules. Player-facing agents (and the GM when narrating
  to the player) query this.
- `kb-gm-secrets` -- GM-ONLY: the rival Kael's true motive and sabotage logic.
  ONLY the Game Master queries this, for internal reasoning. NEVER surface its
  content to the player. (This is what keeps the plot twist hidden.)

## Search endpoint
https://agent-rpg-game-srch.search.windows.net

## How to call retrieval (verified working)
- POST https://agent-rpg-game-srch.search.windows.net/knowledgebases/<KB_NAME>/retrieve?api-version=2026-05-01-preview
- Header: `api-key: <search key from .env>`  (never hardcode; rotate-safe)
- Body -- MUST use `intents`, NOT `messages`, because the KBs are configured
  extractive + minimal reasoning effort (no LLM query planning):
```json
{ "intents": [ { "type": "semantic", "search": "<query text>" } ] }
```
- Response shape:
  - Chunks: `response[].content[].text` is a JSON-string array of
    `{ ref_id, title, content }` -- parse it.
  - Citations: `references[]` (use `ref_id` / `docKey` for source attribution).

## Gotchas already solved (don't repeat)
- `messages` input -> 400 on these KBs. Use `intents`.
- A chat model on the KB is NOT used (extractive mode). Don't attach one.
- gpt-oss-120b rejects some agent-playground params ("invalid parameter").
  Use a standard GPT model (gpt-4o-mini / gpt-4.1-mini) for the AGENTS.
- Auth: search service needs API key OR the project managed identity needs
  `Search Index Data Reader` role on the search service.

## For the agents
- GM and character agents ground narration by calling
  `knowledgebaseforrpggame` before describing important scenes.
- The GM (only) may also query `kb-gm-secrets` to reason about Kael -- but must
  never reveal that content to the player.
- Reference implementation: see `tests/test_retrieval.py` (key removed; pass key via
  env var SEARCH_KEY).

## TODO (depends on agent layer existing first)
- Wire the Mage agent's retrieval to `knowledgebaseforrpggame` (D2).
