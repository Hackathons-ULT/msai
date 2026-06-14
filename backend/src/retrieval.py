from __future__ import annotations

import json
import os

import requests

from .tools import LocalLoreRetriever, RetrievedChunk, RetrievedLore

_ENDPOINT = os.getenv("AZURE_SEARCH_ENDPOINT", "https://agent-rpg-game-srch.search.windows.net")
_KEY = os.getenv("AZURE_SEARCH_KEY", "")
_PLAYER_KB = os.getenv("PLAYER_KB", "knowledgebaseforrpggame")
_GM_KB = os.getenv("GM_KB", "kb-gm-secrets")
_API_VERSION = "2026-05-01-preview"


class FoundryIQLoreRetriever:
    """Retrieves lore from Foundry IQ via Azure AI Search.

    scope='player' -> knowledgebaseforrpggame (all public world lore)
    scope='gm'     -> kb-gm-secrets (Kael's hidden motive; never surface to player)
    """

    def __init__(
        self,
        endpoint: str = _ENDPOINT,
        key: str = _KEY,
        player_kb: str = _PLAYER_KB,
        gm_kb: str = _GM_KB,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.player_kb = player_kb
        self.gm_kb = gm_kb
        self._headers = {"Content-Type": "application/json", "api-key": key}

    def retrieve(self, query: str, scope: str = "player", top_k: int = 3) -> RetrievedLore:
        query = (query or "").strip()
        kb = self.gm_kb if scope == "gm" else self.player_kb
        url = f"{self.endpoint}/knowledgebases/{kb}/retrieve?api-version={_API_VERSION}"
        body = {"intents": [{"type": "semantic", "search": query}]}

        try:
            resp = requests.post(url, headers=self._headers, json=body, timeout=15)
            resp.raise_for_status()
        except Exception:
            return RetrievedLore(query=query, scope=scope, chunks=[], citations=[])

        data = resp.json()
        chunks: list[RetrievedChunk] = []
        citations: list[str] = []

        for item in data.get("response", []):
            for c in item.get("content", []):
                raw = c.get("text")
                if not raw:
                    continue
                try:
                    raw_chunks = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    continue
                for i, ch in enumerate(raw_chunks[:top_k]):
                    chunks.append(RetrievedChunk(
                        title=ch.get("title", ""),
                        content=ch.get("content", ""),
                        source=ch.get("ref_id", str(i)),
                        score=round(1.0 - i * 0.1, 2),
                    ))

        for ref in data.get("references", []):
            doc_key = ref.get("docKey") or ref.get("id") or ""
            if doc_key and doc_key not in citations:
                citations.append(doc_key)

        return RetrievedLore(query=query, scope=scope, chunks=chunks[:top_k], citations=citations)


def build_lore_retriever() -> FoundryIQLoreRetriever | LocalLoreRetriever:
    """Return FoundryIQLoreRetriever when AZURE_SEARCH_KEY is set, else fall back to local."""
    if _KEY:
        return FoundryIQLoreRetriever()
    return LocalLoreRetriever()
