from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from .game_manager import GameManager


@dataclass
class RetrievedChunk:
    title: str
    content: str
    source: str
    score: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RetrievedLore:
    query: str
    scope: str
    chunks: list[RetrievedChunk]
    citations: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "scope": self.scope,
            "chunks": [chunk.to_dict() for chunk in self.chunks],
            "citations": list(self.citations),
        }


class LocalLoreRetriever:
    """Tiny markdown retriever used as a deterministic stand-in for Foundry IQ.

    The retriever scans the local world pack and returns the most relevant
    sections by simple token overlap. This keeps the app fully runnable while
    preserving the retrieval boundary that AI Lead 2 will later replace with the
    real knowledge-base call.
    """

    def __init__(self, world_pack_dir: Path | None = None) -> None:
        self.world_pack_dir = world_pack_dir or Path(__file__).resolve().parents[1] / "world_pack"
        self._documents = self._load_documents()

    def refresh(self) -> None:
        self._documents = self._load_documents()

    def retrieve(self, query: str, scope: str = "player", top_k: int = 3) -> RetrievedLore:
        query = (query or "").strip()
        if not self._documents:
            return RetrievedLore(query=query, scope=scope, chunks=[], citations=[])

        query_tokens = self._tokenize(query)
        scored: list[tuple[float, RetrievedChunk]] = []
        for doc in self._documents:
            if scope != "gm" and doc["secret"]:
                continue
            score = self._score(query_tokens, doc["text"], doc["title"], doc["keywords"])
            if score <= 0:
                continue
            scored.append(
                (
                    score,
                    RetrievedChunk(
                        title=doc["title"],
                        content=doc["snippet"],
                        source=doc["source"],
                        score=score,
                    ),
                )
            )

        if not scored:
            # Fallback to a small, safe default so the GM can still ground itself.
            fallback = self._documents[0]
            scored = [
                (
                    0.1,
                    RetrievedChunk(
                        title=fallback["title"],
                        content=fallback["snippet"],
                        source=fallback["source"],
                        score=0.1,
                    ),
                )
            ]

        scored.sort(key=lambda item: (-item[0], item[1].title))
        chunks = [chunk for _, chunk in scored[:top_k]]
        citations = [chunk.source for chunk in chunks]
        return RetrievedLore(query=query, scope=scope, chunks=chunks, citations=citations)

    def _load_documents(self) -> list[dict[str, Any]]:
        docs: list[dict[str, Any]] = []
        if not self.world_pack_dir.exists():
            return docs

        for path in sorted(self.world_pack_dir.glob("*.md")):
            text = path.read_text(encoding="utf-8").strip()
            if not text:
                continue
            title = path.stem.replace("_", " ").title()
            first_heading = self._extract_first_heading(text)
            snippet = self._clean_snippet(text)
            docs.append(
                {
                    "title": first_heading or title,
                    "text": text,
                    "snippet": snippet,
                    "source": f"world_pack/{path.name}",
                    "secret": path.stem in {"rival", "main_quest_secret"},
                    "keywords": self._keywords_from_text(text),
                }
            )
        return docs

    def _extract_first_heading(self, text: str) -> str | None:
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("#"):
                return line.lstrip("#").strip()
        return None

    def _clean_snippet(self, text: str, limit: int = 260) -> str:
        lines: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.upper().startswith("GM ONLY:"):
                break
            lines.append(stripped)
        snippet = " ".join(lines)
        return snippet[:limit] + ("…" if len(snippet) > limit else "")

    def _keywords_from_text(self, text: str) -> set[str]:
        return set(self._tokenize(text))

    def _tokenize(self, text: str) -> list[str]:
        import re

        return [tok for tok in re.findall(r"[a-z0-9']+", text.lower()) if len(tok) > 2]

    def _score(self, query_tokens: list[str], text: str, title: str, keywords: set[str]) -> float:
        if not query_tokens:
            return 0.1

        text_tokens = set(self._tokenize(text))
        title_tokens = set(self._tokenize(title))
        score = 0.0
        for token in query_tokens:
            if token in title_tokens:
                score += 3.0
            if token in text_tokens:
                score += 1.5
            if token in keywords:
                score += 0.5

        # Extra boost for direct phrase matches.
        lowered_text = text.lower()
        lowered_title = title.lower()
        for token in query_tokens:
            if token in lowered_title:
                score += 0.2
            if token in lowered_text:
                score += 0.1
        return score


class RPGTools:
    def __init__(self, gm: GameManager, retriever: LocalLoreRetriever | None = None) -> None:
        self.gm = gm
        self.retriever = retriever or LocalLoreRetriever()

    def roll_dice(self, actor: str, check: str, difficulty: int, modifier: int = 0) -> dict[str, Any]:
        return self.gm.roll_dice(actor, check, difficulty, modifier)

    def update_state(self, **kwargs: Any) -> list[str]:
        return self.gm.update(**kwargs)

    def apply_patch(self, patch: dict[str, Any]) -> list[str]:
        if not patch:
            return []
        return self.gm.update(
            location=patch.get("location"),
            active_quest=patch.get("active_quest"),
            health_changes=patch.get("health_changes"),
            inventory_add=patch.get("inventory_add"),
            inventory_remove=patch.get("inventory_remove"),
            flags_set=patch.get("flags_set"),
            objectives=patch.get("objectives"),
            narration=patch.get("narration"),
        )

    def get_state(self) -> dict[str, Any]:
        return self.gm.get_state()

    def retrieve_lore(self, query: str, scope: str = "player") -> RetrievedLore:
        return self.retriever.retrieve(query, scope=scope)

    def clear_trace(self) -> None:
        self.gm.clear_trace()
