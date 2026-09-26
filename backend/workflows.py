"""User-controlled review, decision history and portable backup workflows."""

import json
from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field, ConfigDict, ValidationError

from . import engine, store
from .models import Category, PurchaseUnderstanding

router = APIRouter(prefix="/api")


@router.get("/purchase-scenario")
def scenario(price: str = Query(...), original_price: str | None = None):
    amount = engine.cents(price)
    if amount < 0:
        raise ValueError("The scenario price cannot be negative.")
    with store.connection() as db:
        d = store.snapshot(db)
    result = engine.impact(
        amount,
        engine.cents(d["available"]),
        d["goal"]["target_cents"],
        d["goal"]["saved_cents"],
        d["goal"]["monthly_cents"],
        date.fromisoformat(d["profile"]["as_of"]),
    )
    original = amount if original_price is None else engine.cents(original_price)
    if original < amount:
        raise ValueError("Choose a comparison price between zero and the original price.")
    original_impact = engine.impact(
        original,
        engine.cents(d["available"]),
        d["goal"]["target_cents"],
        d["goal"]["saved_cents"],
        d["goal"]["monthly_cents"],
        date.fromisoformat(d["profile"]["as_of"]),
    )
    result.update(
        difference=engine.dollars(original - amount),
        days_kept=original_impact["delay_days"] - result["delay_days"]
        if result["delay_days"] is not None
        else None,
    )
    return result


class ReviewItem(BaseModel):
    id: int
    merchant: str = Field(max_length=160)
    category: Category


class ReviewRequest(BaseModel):
    items: list[ReviewItem] = Field(max_length=5000)


@router.post("/transactions/review-categories")
def apply_categories(body: ReviewRequest):
    if any(i.category in {"Income", "Savings", "Other"} for i in body.items):
        raise ValueError("Choose an expense category for these suggestions.")
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        for item in body.items:
            row = db.execute("SELECT * FROM transactions WHERE id=?", (item.id,)).fetchone()
            if not row or row["category"] != "Other" or row["merchant"] != item.merchant:
                raise HTTPException(
                    409, "A transaction changed since this scan. Run a new scan to review it."
                )
            db.execute("UPDATE transactions SET category=? WHERE id=?", (item.category, item.id))
    return {"count": len(body.items)}


@router.post("/events/{event_id:path}/unconfirm")
def unconfirm(event_id: str):
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        event = db.execute("SELECT * FROM events WHERE id=? AND active=1", (event_id,)).fetchone()
        before = store.snapshot(db)["goal"]["saved_cents"]
        if not db.execute("UPDATE events SET confirmed=0 WHERE id=? AND active=1", (event_id,)).rowcount:
            raise HTTPException(404, "This decision is no longer active.")
        if event["confirmed"]:
            rebase_goal(db, max(0, before - event["amount_cents"]))
        return store.snapshot(db)


def rebase_goal(db, saved):
    goal = store.get(db, "goal")
    confirmed = sum(e["amount_cents"] for e in store.rows(db, "events") if e["confirmed"])
    goal["initial_cents"] = saved - confirmed
    store.put(db, "goal", goal)


@router.post("/events/{event_id:path}/undo")
def undo_event(event_id: str):
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        event = db.execute("SELECT * FROM events WHERE id=? AND active=1", (event_id,)).fetchone()
        before = store.snapshot(db)["goal"]["saved_cents"]
        if not db.execute(
            "UPDATE events SET active=0,confirmed=0 WHERE id=? AND active=1", (event_id,)
        ).rowcount:
            raise HTTPException(404, "This decision has already been undone.")
        if event["confirmed"]:
            rebase_goal(db, max(0, before - event["amount_cents"]))
        db.execute("UPDATE purchases SET resolved=0 WHERE id=?", (event_id,))
        return store.snapshot(db)


class CheckPlan(BaseModel):
    hours: int = Field(default=48, ge=1, le=168)
    target_price: str | None = None


@router.post("/purchases/{purchase_id}/plan")
def plan_check(purchase_id: str, body: CheckPlan):
    from datetime import timedelta

    target = None if body.target_price in {None, ""} else engine.cents(body.target_price)
    with store.connection() as db:
        row = db.execute("SELECT * FROM purchases WHERE id=?", (purchase_id,)).fetchone()
        if not row or row["resolved"]:
            raise HTTPException(409, "Reopen an active purchase check before setting a reminder.")
        p = json.loads(row["value"])
        if target is not None and (target <= 0 or (p["price_cents"] and target >= p["price_cents"])):
            raise ValueError("The target price must be positive and lower than the current price.")
        p.update(
            target_price_cents=target,
            reminder_hours=body.hours,
            wait_until=(datetime.now(timezone.utc) + timedelta(hours=body.hours)).isoformat(),
        )
        db.execute("UPDATE purchases SET value=? WHERE id=?", (json.dumps(p), purchase_id))
    return p


@router.get("/purchase-history")
def check_history(
    status: Literal["active", "archived"] = "active",
    offset: int = Query(0, ge=0),
    q: str = Query("", max_length=160),
):
    with store.connection() as db:
        # Search values in Python so literal '%' and '_' remain literal user text.
        items = [
            json.loads(r[0])
            for r in db.execute(
                "SELECT value FROM purchases WHERE resolved=? ORDER BY rowid DESC",
                (0 if status == "active" else 2,),
            )
        ]
    items = [p for p in items if q.casefold() in p["product_name"].casefold()]
    return {"items": items[offset : offset + 10], "total": len(items)}


class ArchiveRequest(BaseModel):
    archived: bool


@router.post("/purchases/{purchase_id}/archive")
def archive_check(purchase_id: str, body: ArchiveRequest):
    with store.connection() as db:
        row = db.execute("SELECT resolved FROM purchases WHERE id=?", (purchase_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Purchase check not found.")
        if row[0] == 1:
            raise HTTPException(409, "Undo the recorded decision in Activity before archiving its check.")
        db.execute("UPDATE purchases SET resolved=? WHERE id=?", (2 if body.archived else 0, purchase_id))
    return {"ok": True}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)


class BackupProfile(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    budget_cents: int = Field(ge=0, le=1_000_000_000)
    onboarded: bool = True
    demo: Literal[False] = False
    ai_enabled: bool = False


class BackupGoal(StrictModel):
    name: str = Field(min_length=1, max_length=80)
    target_cents: int = Field(gt=0, le=1_000_000_000)
    initial_cents: int = Field(ge=-1_000_000_000_000, le=1_000_000_000_000)
    monthly_cents: int = Field(ge=0, le=1_000_000_000)


class BackupTransaction(StrictModel):
    id: int = Field(gt=0)
    date: str
    merchant: str = Field(min_length=1, max_length=160)
    amount_cents: int = Field(ge=-1_000_000_000, le=1_000_000_000)
    category: Category


class BackupEvent(StrictModel):
    id: str = Field(min_length=1, max_length=200)
    date: str
    type: Literal[
        "purchase_skipped",
        "cheaper_alternative_selected",
        "subscription_cancelled",
        "money_redirected_to_goal",
    ]
    amount_cents: int = Field(gt=0, le=1_000_000_000)
    recurring_cents: int = Field(default=0, ge=0, le=1_000_000_000)
    description: str = Field(min_length=1, max_length=500)
    confirmed: Literal[0, 1] = 0
    active: Literal[0, 1] = 1


class BackupGuard(StrictModel):
    enabled: bool
    limit_cents: int = Field(gt=0, le=1_000_000_000)
    cooldown_until: str | None = None


class Backup(StrictModel):
    schema_version: Literal[1, 2] = 1
    profile: BackupProfile
    goal: BackupGoal
    transactions: list[BackupTransaction] = Field(max_length=50000)
    decisions: list[BackupEvent] = Field(max_length=10000)
    purchases: list[dict] = Field(default_factory=list, max_length=10000)
    guard: BackupGuard


def valid_time(value):
    when = datetime.fromisoformat(value)
    if when.tzinfo is None:
        raise ValueError("Backup times must include a time zone.")
    return when.isoformat()


def validate_backup(payload):
    try:
        b = Backup.model_validate(payload).model_dump()
        for name in (b["profile"]["name"], b["goal"]["name"]):
            if not name.strip():
                raise ValueError("Backup names cannot be blank.")
        for key in ("transactions", "decisions", "purchases"):
            ids = [r["id"] for r in b[key]]
            if len(ids) != len(set(ids)):
                raise ValueError("The backup contains duplicate record IDs.")
        for t in b["transactions"] + b["decisions"]:
            if str(date.fromisoformat(t["date"])) != t["date"] or t["date"] > str(date.today()):
                raise ValueError("Backup dates must be valid and not in the future.")
        for t in b["transactions"]:
            if not t["merchant"].strip() or (
                t["amount_cents"] != 0 and (t["category"] == "Income") != (t["amount_cents"] > 0)
            ):
                raise ValueError("A backup transaction has an invalid amount or category.")
        for p in b["purchases"]:
            parsed = PurchaseUnderstanding.model_validate(p).model_dump()
            if not isinstance(p["id"], str) or not 1 <= len(p["id"]) <= 200:
                raise ValueError("Invalid purchase ID.")
            UUID(p["id"])
            amount = p.get("price_cents")
            if amount is not None and (type(amount) is not int or not 0 < amount <= 1_000_000_000):
                raise ValueError("Invalid purchase price.")
            status = p.get("resolved", False)
            if type(status) not in {int, bool} or status not in {0, 1, 2}:
                raise ValueError("Invalid purchase status.")
            target = p.get("target_price_cents")
            if target is not None and (type(target) is not int or not 0 < target <= 1_000_000_000):
                raise ValueError("Invalid target price.")
            normalized = {
                **parsed,
                "id": p["id"],
                "price_cents": amount,
                "detected_price": engine.dollars(amount) if amount is not None else None,
                "price_confirmed": p.get("price_confirmed") is True and amount is not None,
                "resolved": int(status),
                "target_price_cents": target,
                "reminder_hours": max(1, min(168, int(p.get("reminder_hours", 48)))),
                "ai": {
                    "status": "restored",
                    "model": None,
                    "message": "Restored purchase check. Run a new check for fresh AI analysis.",
                },
            }
            if p.get("wait_until"):
                normalized["wait_until"] = valid_time(p["wait_until"])
            p.clear()
            p.update(normalized)
        if b["guard"]["cooldown_until"]:
            b["guard"]["cooldown_until"] = valid_time(b["guard"]["cooldown_until"])
        b["profile"].update(
            first_name=b["profile"]["name"].split()[0],
            role="Personal profile",
            as_of=str(date.today()),
            onboarded=True,
            ai_enabled=False,
        )
        return b
    except (ValidationError, KeyError, TypeError, OverflowError) as exc:
        raise ValueError("This is not a valid SpendShield backup. No data was changed.") from exc


def export_data(db):
    return {
        "schema_version": 2,
        "profile": store.get(db, "profile"),
        "goal": store.get(db, "goal"),
        "transactions": store.rows(db, "transactions"),
        "decisions": [dict(r) for r in db.execute("SELECT * FROM events")],
        "purchases": [
            json.loads(r[0]) | {"resolved": r[1]} for r in db.execute("SELECT value,resolved FROM purchases")
        ],
        "guard": store.get(db, "guard"),
    }


def replace_data(db, b):
    for table in ("transactions", "events", "purchases"):
        db.execute(f"DELETE FROM {table}")
    for key in ("profile", "goal", "guard"):
        store.put(db, key, b[key])
    db.executemany(
        "INSERT INTO transactions(id,date,merchant,amount_cents,category) VALUES(:id,:date,:merchant,:amount_cents,:category)",
        b["transactions"],
    )
    db.executemany(
        "INSERT INTO events(id,date,type,amount_cents,recurring_cents,description,confirmed,active) VALUES(:id,:date,:type,:amount_cents,:recurring_cents,:description,:confirmed,:active)",
        b["decisions"],
    )
    db.executemany(
        "INSERT INTO purchases(id,value,resolved) VALUES(?,?,?)",
        [(p["id"], json.dumps(p), int(p.get("resolved", 0))) for p in b["purchases"]],
    )


async def read_backup(file):
    data = await file.read(10_000_001)
    if len(data) > 10_000_000:
        raise ValueError("Choose a SpendShield JSON backup under 10 MB.")
    try:
        return validate_backup(json.loads(data))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Choose a valid SpendShield JSON backup.") from exc


@router.post("/profile/restore-preview")
async def restore_preview(file: UploadFile = File(...)):
    b = await read_backup(file)
    return {
        "name": b["profile"]["name"],
        "transactions": len(b["transactions"]),
        "decisions": len(b["decisions"]),
        "goal": b["goal"]["name"],
    }


@router.post("/profile/restore")
async def restore(file: UploadFile = File(...), confirm: bool = Query(False)):
    if not confirm:
        raise ValueError("Confirm that you want to replace the current profile with this backup.")
    b = await read_backup(file)
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        store.put(db, "restore_recovery", export_data(db))
        replace_data(db, b)
    return {"ok": True}


@router.get("/profile/recovery")
def recovery_status():
    with store.connection() as db:
        return {
            "available": bool(db.execute("SELECT 1 FROM settings WHERE key='restore_recovery'").fetchone())
        }


@router.post("/profile/undo-restore")
def undo_restore():
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT 1 FROM settings WHERE key='restore_recovery'").fetchone():
            raise HTTPException(404, "No restore to undo.")
        previous = store.get(db, "restore_recovery")
        # Recovery snapshots are internal, not user-uploaded files.
        replace_data(db, previous)
        db.execute("DELETE FROM settings WHERE key='restore_recovery'")
    return {"ok": True}
