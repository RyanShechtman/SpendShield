import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from backend.models import Insights
from backend.services.gemini_service import GeminiService, AIUnavailable


class Pager:
    def __init__(self, models):
        self.models = models

    def __aiter__(self):
        self.iterator = iter(self.models)
        return self

    async def __anext__(self):
        try:
            return next(self.iterator)
        except StopIteration:
            raise StopAsyncIteration


def fake_client(names, outcomes):
    models = SimpleNamespace(
        list=AsyncMock(
            return_value=Pager(
                [SimpleNamespace(name="models/" + name, supported_actions=actions) for name, actions in names]
            )
        ),
        generate_content=AsyncMock(side_effect=outcomes),
    )
    return SimpleNamespace(aio=SimpleNamespace(models=models))


def test_discovery_intersection_and_model_fallback():
    client = fake_client(
        [
            ("gemini-2.5-flash", ["generateContent"]),
            ("gemini-3.8-flash", ["generateContent"]),
            ("gemini-3.7-flash", ["embedContent"]),
        ],
        [RuntimeError("429"), SimpleNamespace(text='{"insights":[]}')],
    )
    service = GeminiService(client)
    parsed, meta = asyncio.run(service.generate(Insights, "test"))
    assert parsed.insights == []
    assert meta["model"] == "gemini-2.5-flash"
    calls = client.aio.models.generate_content.call_args_list
    assert [c.kwargs["model"] for c in calls] == ["gemini-3.8-flash", "gemini-2.5-flash"]


def test_schema_failure_tries_next_model():
    client = fake_client(
        [("gemini-3.8-flash", ["generateContent"]), ("gemini-3.6-flash", ["generateContent"])],
        [SimpleNamespace(text='{"wrong":1}'), SimpleNamespace(text='{"insights":[]}')],
    )
    assert asyncio.run(GeminiService(client).generate(Insights, "test"))[1]["model"] == "gemini-3.6-flash"


def test_no_undiscovered_model_attempts():
    client = fake_client([("other-model", ["generateContent"])], [])
    with pytest.raises(AIUnavailable):
        asyncio.run(GeminiService(client).generate(Insights, "test"))
    client.aio.models.generate_content.assert_not_called()


def test_every_model_fails_cleanly():
    client = fake_client([("gemini-3.8-flash", ["generateContent"])], [RuntimeError("503 provider detail")])
    with pytest.raises(AIUnavailable, match="core financial analysis"):
        asyncio.run(GeminiService(client).generate(Insights, "test"))


def test_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert asyncio.run(GeminiService().status())["status"] == "unavailable"


def test_sdk_deadline_meets_provider_minimum(monkeypatch):
    from unittest.mock import Mock
    from backend.services import gemini_service

    factory = Mock()
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-placeholder")
    monkeypatch.setattr(gemini_service.genai, "Client", factory)
    GeminiService()
    assert factory.call_args.kwargs["http_options"].timeout >= 10000
