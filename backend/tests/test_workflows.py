import json
from datetime import date, datetime, timezone

from backend import main, store
from backend.models import Classifications, Insights
from backend.tests.test_personal import SETUP


def check(c, text="Shoes", price="100"):
    return c.post("/api/ai/analyze-purchase", json={"text": text, "price": price, "use_ai": False}).json()


def initialize(c):
    assert c.post("/api/profile/setup", json=SETUP).status_code == 200


def test_decision_can_be_unconfirmed_undone_and_made_again(personal_client):
    c = personal_client
    initialize(c)
    p = check(c)
    body = {"purchase_id": p["id"], "action": "purchase_skipped"}
    c.post("/api/purchases/protect", json=body)
    assert c.post(f"/api/events/{p['id']}/confirm-saved").json()["goal"]["saved"] == 300
    for _ in range(2):
        assert c.post(f"/api/events/{p['id']}/unconfirm").json()["goal"]["saved"] == 200
    assert c.post(f"/api/events/{p['id']}/undo").json()["goal"]["planned"] == 0
    assert c.post(f"/api/events/{p['id']}/undo").status_code == 404
    assert c.post(f"/api/events/{p['id']}/confirm-saved").status_code == 404
    assert c.get("/api/purchase-history").json()["total"] == 1
    assert c.post("/api/purchases/protect", json=body).json()["dashboard"]["goal"]["planned"] == 100


def test_archive_pagination_search_and_restore(personal_client):
    c = personal_client
    initialize(c)
    for i in range(23):
        p = check(c, f"Shoes {i}")
    page = c.get("/api/purchase-history?offset=20").json()
    assert page["total"] == 23 and len(page["items"]) == 3
    assert len(c.get("/api/purchases/pending").json()) == 23
    assert c.post(f"/api/purchases/{p['id']}/archive", json={"archived": True}).status_code == 200
    assert c.get("/api/purchase-history?status=archived").json()["total"] == 1
    assert c.post(f"/api/purchases/{p['id']}/plan", json={"hours": 48}).status_code == 409
    c.post(f"/api/purchases/{p['id']}/archive", json={"archived": False})
    assert c.get("/api/purchase-history?q=Shoes%2022").json()["total"] == 1
    assert c.get("/api/purchase-history?q=%25").json()["total"] == 0


def test_target_price_reminder_and_scenario(personal_client):
    c = personal_client
    initialize(c)
    p = check(c)
    endpoint = f"/api/purchases/{p['id']}/plan"
    assert c.post(endpoint, json={"hours": 169}).status_code == 422
    assert c.post(endpoint, json={"hours": 24, "target_price": "101"}).status_code == 400
    plan = c.post(endpoint, json={"hours": 24, "target_price": "60"}).json()
    assert plan["target_price_cents"] == 6000
    seconds = (datetime.fromisoformat(plan["wait_until"]) - datetime.now(timezone.utc)).total_seconds()
    assert 86390 < seconds <= 86400
    result = c.get("/api/purchase-scenario?price=60").json()
    assert result["delay_days"] == 18
    assert c.get("/api/dashboard").json()["goal"]["saved"] == 200
    assert c.get("/api/purchase-scenario?price=-1").status_code == 400


def test_ai_categories_are_proposed_not_applied_and_stale_review_is_atomic(personal_client, monkeypatch):
    c = personal_client
    initialize(c)
    c.post("/api/profile", json={"name": "Maya", "ai_enabled": True})
    for merchant in ["AMBIGUOUS", "SECOND"]:
        c.post(
            "/api/transactions",
            json={"date": str(date.today()), "merchant": merchant, "amount": "20", "category": "Other"},
        )

    async def generate(schema, prompt, *args):
        if schema is Classifications:
            return Classifications(
                transactions=[
                    {
                        "merchant": name,
                        "normalized_merchant": name.title(),
                        "category": "Groceries",
                        "confidence": 0.95,
                    }
                    for name in ["AMBIGUOUS", "SECOND"]
                ]
            ), {"status": "live", "model": "test"}
        return Insights(insights=[]), {"status": "live", "model": "test"}

    monkeypatch.setattr(main.gemini, "generate", generate)
    result = c.post("/api/ai/financial-scan").json()
    assert result["classified_count"] == 0 and len(result["suggestions"]) == 2
    assert all(t["category"] == "Other" for t in c.get("/api/transactions").json()["transactions"])
    items = [{k: s[k] for k in ("id", "merchant", "category")} for s in result["suggestions"]]
    stale = [items[0], {**items[1], "merchant": "changed"}]
    assert c.post("/api/transactions/review-categories", json={"items": stale}).status_code == 409
    assert all(t["category"] == "Other" for t in c.get("/api/transactions").json()["transactions"])
    assert c.post("/api/transactions/review-categories", json={"items": items}).json()["count"] == 2
    assert c.get("/api/dashboard").json()["available"] == 500


def backup_file(payload):
    return {"file": ("backup.json", json.dumps(payload).encode(), "application/json")}


def test_backup_roundtrip_archives_and_recovery(personal_client):
    c = personal_client
    initialize(c)
    p = check(c)
    c.post(f"/api/purchases/{p['id']}/archive", json={"archived": True})
    original = c.get("/api/profile/export").json()
    assert original["purchases"][0]["resolved"] == 2
    c.post("/api/profile", json={"name": "Changed profile", "ai_enabled": True})
    assert c.post("/api/profile/restore-preview", files=backup_file(original)).json()["name"] == "Maya Chen"
    assert c.get("/api/dashboard").json()["profile"]["name"] == "Changed profile"
    assert c.post("/api/profile/restore", files=backup_file(original)).status_code == 400
    assert c.post("/api/profile/restore?confirm=true", files=backup_file(original)).status_code == 200
    d = c.get("/api/dashboard").json()
    assert d["profile"]["name"] == "Maya Chen" and not d["profile"]["ai_enabled"]
    assert c.get("/api/purchase-history?status=archived").json()["total"] == 1
    assert c.post("/api/profile/undo-restore").status_code == 200
    assert c.get("/api/dashboard").json()["profile"]["name"] == "Changed profile"
    assert c.post("/api/profile/undo-restore").status_code == 404


def test_malformed_backups_leave_current_data_intact(personal_client):
    c = personal_client
    initialize(c)
    before = c.get("/api/profile/export").json()
    for payload in [
        {},
        {
            **before,
            "transactions": [
                {"id": 1, "date": "bad", "merchant": "x", "category": "Income", "amount_cents": 100}
            ],
        },
        {**before, "guard": {"enabled": True, "limit_cents": 0}},
        {**before, "profile": {**before["profile"], "name": " "}},
    ]:
        assert c.post("/api/profile/restore?confirm=true", files=backup_file(payload)).status_code in {
            400,
            422,
        }
        assert c.get("/api/profile/export").json() == before


def test_over_budget_is_visible_and_schema_migration_is_repeatable(personal_client):
    c = personal_client
    initialize(c)
    c.post(
        "/api/transactions",
        json={"date": str(date.today()), "merchant": "Shop", "amount": "520.50", "category": "Shopping"},
    )
    for _ in range(2):
        store.init()
        d = c.get("/api/dashboard").json()
        assert d["available"] == 0 and d["over_budget"] == 20.5
