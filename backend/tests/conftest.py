import pytest
from fastapi.testclient import TestClient
from backend import main
from backend.services.gemini_service import GeminiService


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("SPENDSHIELD_DB", str(tmp_path / "test.sqlite3"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(main, "gemini", GeminiService())
    monkeypatch.setenv("SPENDSHIELD_ENABLE_DEMO", "1")
    with TestClient(main.app) as client:
        client.post("/api/demo/reset")
        yield client


@pytest.fixture
def personal_client(tmp_path, monkeypatch):
    monkeypatch.setenv("SPENDSHIELD_DB", str(tmp_path / "personal.sqlite3"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("SPENDSHIELD_ENABLE_DEMO", raising=False)
    monkeypatch.setattr(main, "gemini", GeminiService())
    with TestClient(main.app) as client:
        yield client
