from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from dotenv import load_dotenv

from openai import OpenAI

load_dotenv()


@dataclass
class LLMResult:
    used: bool
    text: str | None = None
    raw: Any | None = None


class LocalLLMClient:
    def __init__(self, client: OpenAI | None, model: str | None) -> None:
        self.client = client
        self.model = model

    @property
    def available(self) -> bool:
        return self.client is not None and bool(self.model)

    @classmethod
    def from_env(cls) -> "LocalLLMClient":
        endpoint = (
            os.getenv("AZURE_AI_PROJECT_ENDPOINT")
            or os.getenv("AZURE_OPENAI_ENDPOINT")
            or os.getenv("OPENAI_BASE_URL")
            or ""
        ).strip()
        api_key = (
            os.getenv("AZURE_AI_API_KEY")
            or os.getenv("AZURE_OPENAI_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or ""
        ).strip()
        model = (
            os.getenv("AZURE_AI_MODEL_DEPLOYMENT")
            or os.getenv("AZURE_OPENAI_DEPLOYMENT")
            or os.getenv("OPENAI_MODEL")
            or ""
        ).strip()

        if not endpoint or not api_key or not model or OpenAI is None:
            return cls(None, model or None)

        base_url = endpoint.rstrip("/")
        if not base_url.endswith("/openai/v1"):
            base_url = f"{base_url}/openai/v1"

        return cls(OpenAI(base_url=base_url, api_key=api_key), model)

    def complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 800,
        json_mode: bool = False,
    ) -> LLMResult:
        if not self.available:
            return LLMResult(used=False, text=None, raw=None)

        # Prefer the OpenAI-compatible Responses API exposed by Foundry projects.
        try:
            kwargs: dict[str, Any] = {
                "model": self.model,
                "input": messages,
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            resp = self.client.responses.create(**kwargs)
            text = getattr(resp, "output_text", None)
            if text:
                return LLMResult(used=True, text=text.strip(), raw=resp)
        except Exception:
            pass

        # Fallback to chat.completions for compatible endpoints.
        try:
            kwargs = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}

            resp = self.client.chat.completions.create(**kwargs)
            text = resp.choices[0].message.content or ""
            return LLMResult(used=True, text=text.strip(), raw=resp)
        except Exception:
            return LLMResult(used=False, text=None, raw=None)
