from datetime import date, timedelta
from backend import main, store

SETUP = {
    "name": "Maya Chen",
    "budget": "500",
    "goal_name": "Moving fund",
    "goal_target": "2000",
    "goal_saved": "200",
    "goal_monthly": "100",
    "ai_enabled": False,
}


def test_setup_and_settings_persist_without_sample_data(personal_client):
    c = personal_client
    initial = c.get("/api/dashboard").json()
    assert not initial["profile"]["onboarded"]
    assert initial["transaction_count"] == 0
    assert initial["goal"]["saved"] == 0
    assert c.post("/api/demo/reset").status_code == 404
    assert c.post("/api/profile/setup", json={**SETUP, "name": "  "}).status_code == 400
    d = c.post("/api/profile/setup", json=SETUP).json()
    assert d["profile"]["first_name"] == "Maya"
    assert d["profile"]["as_of"] == str(date.today())
    assert d["goal"]["saved"] == 200
    assert d["available"] == 500
    assert c.post("/api/profile/setup", json=SETUP).status_code == 409
    c.post("/api/profile", json={"name": "Taylor", "ai_enabled": False})
    store.init()
    assert c.get("/api/dashboard").json()["profile"]["name"] == "Taylor"
    exported = c.get("/api/profile/export")
    assert exported.json()["profile"]["name"] == "Taylor"
    assert "attachment" in exported.headers["Content-Disposition"]
    assert "GEMINI_API_KEY" not in exported.text


def test_transaction_crud_and_import_preview_preserve_data(personal_client):
    c = personal_client
    c.post("/api/profile/setup", json=SETUP)
    entry = {"merchant": "Cafe", "amount": "12.50", "date": str(date.today()), "category": "Restaurants"}
    assert c.post("/api/transactions", json=entry).status_code == 200
    assert c.get("/api/dashboard").json()["available"] == 487.5
    row = c.get("/api/transactions").json()["transactions"][0]
    file = {
        "file": (
            "bank.csv",
            f"date,merchant,amount,category\n{date.today()},Cafe,-12.50,Restaurants\n{date.today()},Salary,1000,Income\n".encode(),
        )
    }
    preview = c.post("/api/transactions/preview", files=file).json()
    assert (preview["new_count"], preview["skipped"]) == (1, 1)
    assert c.get("/api/dashboard").json()["transaction_count"] == 1
    assert c.post("/api/transactions/upload", files=file).json()["count"] == 1
    assert c.post("/api/transactions/upload", files=file).json()["count"] == 0
    assert c.get("/api/dashboard").json()["goal"]["saved"] == 200
    c.put(f"/api/transactions/{row['id']}", json={**entry, "amount": "20"})
    assert c.get("/api/dashboard").json()["available"] == 480
    c.delete(f"/api/transactions/{row['id']}")
    assert c.get("/api/dashboard").json()["available"] == 500
    assert (
        c.post("/api/transactions", json={**entry, "date": str(date.today() + timedelta(days=1))}).status_code
        == 400
    )


def test_planned_savings_require_confirmation_and_use_actual_alternative(personal_client, monkeypatch):
    c = personal_client
    c.post("/api/profile/setup", json=SETUP)

    async def forbidden(*args, **kwargs):
        raise AssertionError("AI must not run without consent")

    monkeypatch.setattr(main.gemini, "generate", forbidden)
    p = c.post(
        "/api/ai/analyze-purchase", json={"text": "Running shoes", "price": "100", "use_ai": True}
    ).json()
    assert p["alternatives"] == []
    body = {
        "purchase_id": p["id"],
        "action": "cheaper_alternative_selected",
        "alternative_name": "Previous season",
        "alternative_price": "60",
    }
    result = c.post("/api/purchases/protect", json=body).json()
    assert result["dashboard"]["goal"]["saved"] == 200
    assert result["dashboard"]["goal"]["planned"] == 40
    assert c.post("/api/purchases/protect", json=body).status_code == 409
    event_id = result["dashboard"]["money_rescued"]["events"][0]["id"]
    for _ in range(2):
        d = c.post(f"/api/events/{event_id}/confirm-saved").json()
        assert d["goal"]["saved"] == 240
        assert d["goal"]["planned"] == 0


def test_no_history_scan_and_extreme_goal_are_safe(personal_client):
    c = personal_client
    assert c.post("/api/ai/financial-scan").status_code == 400
    d = c.post("/api/profile/setup", json={**SETUP, "goal_target": "10000000", "goal_monthly": "0.01"}).json()
    assert d["goal"]["date"] is None
