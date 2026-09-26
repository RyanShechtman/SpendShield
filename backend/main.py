import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from . import engine, store
from .workflows import router as workflow_router, export_data
from .csv_import import parse_csv
from .models import (
    PurchaseRequest,
    PurchaseUnderstanding,
    Insights,
    Classifications,
    ConfirmPrice,
    ProtectRequest,
    GuardSettings,
    GoalRequest,
    BudgetRequest,
    SubscriptionRequest,
    ProfileRequest,
    SetupRequest,
    TransactionRequest,
)
from .services.alternatives import DemoCatalogProvider
from .services.gemini_service import GeminiService, AIUnavailable

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
gemini = GeminiService()
catalog = DemoCatalogProvider()


@asynccontextmanager
async def lifespan(app):
    store.init()
    yield


app = FastAPI(title="SpendShield", version="2.0.0", lifespan=lifespan)
app.include_router(workflow_router)


@app.exception_handler(ValueError)
async def bad_value(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse(
        status_code=422, content={"detail": "Please check the supplied fields and try again."}
    )


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.middleware("http")
async def local_boundary(request, call_next):
    # Single-user local app. Refuse cross-origin mutations and DNS rebinding.
    host = request.url.hostname
    if host not in {"localhost", "127.0.0.1", "::1", "testserver"}:
        return JSONResponse(status_code=403, content={"detail": "Local access only."})
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin not in {
            str(request.base_url).rstrip("/"),
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
        }:
            return JSONResponse(status_code=403, content={"detail": "Cross-origin requests are not allowed."})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


def positive(value, allow_zero=False):
    amount = engine.cents(value)
    if amount < 0 or (amount == 0 and not allow_zero):
        raise ValueError(
            "Enter a positive dollar amount." if not allow_zero else "Enter a nonnegative dollar amount."
        )
    return amount


def ai_off(message="AI is not connected. Showing deterministic analysis."):
    return {"status": "unavailable", "model": None, "message": message}


def purchase_response(purchase, db):
    d = store.snapshot(db)
    price = purchase["price_cents"]
    purchase["impact"] = (
        engine.impact(
            price,
            engine.cents(d["available"]),
            d["goal"]["target_cents"],
            d["goal"]["saved_cents"],
            d["goal"]["monthly_cents"],
            date.fromisoformat(d["profile"]["as_of"]),
        )
        if price is not None
        else None
    )
    purchase["alternatives"] = (
        catalog.search(purchase["product_name"], purchase["category"], price)
        if price and d["profile"].get("demo")
        else []
    )
    return purchase


def save_purchase(understanding, meta, confirmed=False):
    price = understanding.detected_price
    # Reject non-cent values rather than quietly rounding model extraction.
    try:
        amount = positive(price) if price is not None else None
    except ValueError:
        amount = None
    purchase = {
        **understanding.model_dump(),
        "id": str(uuid.uuid4()),
        "detected_price": engine.dollars(amount) if amount is not None else None,
        "price_cents": amount,
        "price_confirmed": confirmed and amount is not None,
        "ai": meta,
        "resolved": False,
    }
    with store.connection() as db:
        db.execute("INSERT INTO purchases(id,value) VALUES(?,?)", (purchase["id"], json.dumps(purchase)))
        return purchase_response(purchase, db)


def read_purchase(db, purchase_id):
    row = db.execute("SELECT * FROM purchases WHERE id=?", (purchase_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Purchase not found. Analyze it again.")
    return json.loads(row["value"]), bool(row["resolved"])


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "SpendShield"}


@app.get("/api/demo/profile")
def profile():
    with store.connection() as db:
        return store.get(db, "profile")


@app.post("/api/demo/reset")
def reset():
    if os.getenv("SPENDSHIELD_ENABLE_DEMO") != "1":
        raise HTTPException(404, "This endpoint is not available.")
    with store.connection() as db:
        store.reset(db)
        return store.snapshot(db)


@app.get("/api/dashboard")
def dashboard():
    with store.connection() as db:
        return store.snapshot(db)


@app.get("/api/transactions")
def transactions():
    with store.connection() as db:
        return {"transactions": store.rows(db, "transactions")}


@app.post("/api/transactions/upload")
async def upload(file: UploadFile = File(...)):
    transactions = parse_csv(await file.read(2_000_001))
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = {
            (t["date"], t["merchant"].casefold(), t["amount_cents"]) for t in store.rows(db, "transactions")
        }
        unique = []
        for t in transactions:
            key = (t["date"], t["merchant"].casefold(), t["amount_cents"])
            if key not in existing:
                unique.append(t)
                existing.add(key)
        db.executemany(
            "INSERT INTO transactions(date,merchant,amount_cents,category) VALUES(:date,:merchant,:amount_cents,:category)",
            unique,
        )
    return {
        "count": len(unique),
        "skipped": len(transactions) - len(unique),
        "message": "Transactions added. Your profile, goal and decisions are unchanged.",
    }


@app.post("/api/transactions/preview")
async def preview_upload(file: UploadFile = File(...)):
    transactions = parse_csv(await file.read(2_000_001))
    with store.connection() as db:
        seen = {
            (t["date"], t["merchant"].casefold(), t["amount_cents"]) for t in store.rows(db, "transactions")
        }
    added = 0
    for t in transactions:
        key = (t["date"], t["merchant"].casefold(), t["amount_cents"])
        if key not in seen:
            added += 1
            seen.add(key)
    return {
        "count": len(transactions),
        "new_count": added,
        "skipped": len(transactions) - added,
        "from": min(t["date"] for t in transactions),
        "to": max(t["date"] for t in transactions),
        "sample": transactions[:5],
    }


@app.post("/api/profile/setup")
def setup(body: SetupRequest):
    name = body.name.strip()
    goal_name = body.goal_name.strip()
    if not name or not goal_name:
        raise ValueError("Please enter your name and a name for your goal.")
    budget = positive(body.budget, True)
    target = positive(body.goal_target)
    saved = positive(body.goal_saved, True)
    monthly = positive(body.goal_monthly, True)
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        profile = store.get(db, "profile")
        if profile.get("onboarded"):
            raise HTTPException(409, "Your profile is already set up. Use Settings to make changes.")
        profile.update(
            name=name,
            first_name=name.split()[0],
            demo=False,
            onboarded=True,
            ai_enabled=body.ai_enabled,
            budget_cents=budget,
        )
        store.put(db, "profile", profile)
        store.put(
            db,
            "goal",
            {"name": goal_name, "target_cents": target, "initial_cents": saved, "monthly_cents": monthly},
        )
        return store.snapshot(db)


@app.post("/api/profile")
def edit_profile(body: ProfileRequest):
    if not body.name.strip():
        raise ValueError("Please enter your preferred name.")
    with store.connection() as db:
        profile = store.get(db, "profile")
        profile.update(name=body.name.strip(), first_name=body.name.split()[0], ai_enabled=body.ai_enabled)
        store.put(db, "profile", profile)
        return profile


def transaction_values(body):
    when = date.fromisoformat(body.date)
    if when > date.today():
        raise ValueError("Use today's date or an earlier date.")
    merchant = body.merchant.strip()
    if not merchant:
        raise ValueError("Enter a merchant or description.")
    amount = positive(body.amount)
    return (str(when), merchant, amount if body.category == "Income" else -amount, body.category)


@app.post("/api/transactions")
def add_transaction(body: TransactionRequest):
    values = transaction_values(body)
    with store.connection() as db:
        db.execute("INSERT INTO transactions(date,merchant,amount_cents,category) VALUES(?,?,?,?)", values)
    return {"ok": True}


@app.put("/api/transactions/{transaction_id}")
def edit_transaction(transaction_id: int, body: TransactionRequest):
    values = transaction_values(body)
    with store.connection() as db:
        cursor = db.execute(
            "UPDATE transactions SET date=?,merchant=?,amount_cents=?,category=? WHERE id=?",
            (*values, transaction_id),
        )
        if not cursor.rowcount:
            raise HTTPException(404, "Transaction not found.")
    return {"ok": True}


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    with store.connection() as db:
        db.execute("DELETE FROM transactions WHERE id=?", (transaction_id,))
    return {"ok": True}


@app.get("/api/profile/export")
def export_profile():
    with store.connection() as db:
        payload = export_data(db)
    return JSONResponse(
        payload, headers={"Content-Disposition": 'attachment; filename="spendshield-data.json"'}
    )


@app.post("/api/events/{event_id:path}/confirm-saved")
def confirm_saved(event_id: str):
    with store.connection() as db:
        cursor = db.execute("UPDATE events SET confirmed=1 WHERE id=? AND active=1", (event_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Decision not found.")
        return store.snapshot(db)


def ai_allowed(context):
    return context["profile"].get("demo") or context["profile"].get("ai_enabled", False)


@app.post("/api/profile/budget")
def budget(body: BudgetRequest):
    with store.connection() as db:
        profile = store.get(db, "profile")
        profile["budget_cents"] = positive(body.monthly_discretionary, True)
        store.put(db, "profile", profile)
    return {"ok": True}


@app.get("/api/gemini/status")
async def gemini_status():
    return await gemini.status()


@app.post("/api/ai/analyze-purchase")
async def analyze(body: PurchaseRequest):
    if not body.text.strip():
        raise ValueError("Describe the purchase you are considering.")
    if body.price is not None:
        positive(body.price)
    meta = ai_off("Manual entry · calculated by SpendShield")
    with store.connection() as db:
        context = store.snapshot(db)
    result = None
    if body.use_ai and ai_allowed(context):
        try:
            result, meta = await gemini.generate(
                PurchaseUnderstanding,
                json.dumps(
                    {
                        "task": "Understand this potential purchase and explain qualitative tradeoffs.",
                        "purchase": body.text,
                        "user_confirmed_price": body.price,
                        "context": context,
                    },
                    default=str,
                ),
            )
        except AIUnavailable as exc:
            meta = ai_off(str(exc))
    if result is None:
        result = PurchaseUnderstanding(
            product_name=body.text[:160],
            detected_price=None,
            category=body.category,
            confidence="low",
            summary="Compare this purchase with your budget and savings plan.",
            tradeoffs=[
                "Consider how often you will use it and whether something you own already meets the need."
            ],
            alternative_queries=[],
            cooldown_recommendation=48,
            explanation="Based on your entered price and recorded financial context.",
        )
    if body.price is not None:
        result.detected_price = float(body.price)
    return save_purchase(result, meta, confirmed=body.price is not None)


@app.post("/api/ai/analyze-purchase-image")
async def analyze_image(file: UploadFile = File(...)):
    data = await file.read(5_000_001)
    if len(data) > 5_000_000:
        raise ValueError("Choose an image under 5 MB.")
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.format not in {"PNG", "JPEG", "WEBP"} or img.width * img.height > 16_000_000:
                raise ValueError("Use a PNG, JPEG or WebP image under 16 megapixels.")
            mime = Image.MIME[img.format]
            img.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError("This image could not be read. Use PNG, JPEG or WebP.") from exc
    with store.connection() as db:
        context = store.snapshot(db)
    if not ai_allowed(context):
        raise HTTPException(
            403, "Enable Gemini in Settings to analyze images, or enter the product and price yourself."
        )
    try:
        result, meta = await gemini.generate(
            PurchaseUnderstanding,
            json.dumps(
                {
                    "task": "Extract the product and USD price from this image; explain tradeoffs.",
                    "context": context,
                }
            ),
            data,
            mime,
        )
        return save_purchase(result, meta)
    except AIUnavailable as exc:
        return JSONResponse(status_code=503, content={"detail": str(exc), "manual_entry_available": True})


@app.post("/api/purchases/{purchase_id}/confirm-price")
def confirm_price(purchase_id: str, body: ConfirmPrice):
    amount = positive(body.price)
    with store.connection() as db:
        purchase, resolved = read_purchase(db, purchase_id)
        if resolved:
            raise HTTPException(409, "This decision is already recorded.")
        purchase.update(price_cents=amount, detected_price=engine.dollars(amount), price_confirmed=True)
        db.execute("UPDATE purchases SET value=? WHERE id=?", (json.dumps(purchase), purchase_id))
        return purchase_response(purchase, db)


@app.post("/api/purchases/protect")
def protect(body: ProtectRequest):
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        purchase, resolved = read_purchase(db, body.purchase_id)
        if resolved:
            raise HTTPException(409, "This decision has already been recorded.")
        if not purchase["price_confirmed"]:
            raise ValueError("Confirm the purchase price before protecting money.")
        amount = purchase["price_cents"]
        description = f"Skipped {purchase['product_name']}"
        if body.action == "cheaper_alternative_selected":
            if body.alternative_price is not None:
                lower_price = positive(body.alternative_price, True)
                if not body.alternative_name or not body.alternative_name.strip():
                    raise ValueError("Name the alternative you found.")
                description = f"Chose {body.alternative_name.strip()} instead of {purchase['product_name']}"
                amount -= lower_price
            elif store.get(db, "profile").get("demo"):
                alternatives = catalog.search(purchase["product_name"], purchase["category"], amount)
                alternative = next((p for p in alternatives if p["id"] == body.alternative_id), None)
                if not alternative:
                    raise ValueError("Select a listed alternative.")
                amount -= engine.cents(alternative["price"])
                description = f"Chose {alternative['name']} instead of {purchase['product_name']}"
            else:
                raise ValueError("Enter the actual price of the alternative you found.")
        if amount <= 0:
            raise ValueError("No positive savings to record.")
        when = store.get(db, "profile")["as_of"]
        db.execute(
            "INSERT INTO events(id,date,type,amount_cents,recurring_cents,description) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,type=excluded.type,amount_cents=excluded.amount_cents,recurring_cents=excluded.recurring_cents,description=excluded.description,confirmed=0,active=1",
            (body.purchase_id, when, body.action, amount, 0, description),
        )
        db.execute("UPDATE purchases SET resolved=1 WHERE id=?", (body.purchase_id,))
        return {"protected": engine.dollars(amount), "dashboard": store.snapshot(db)}


@app.post("/api/purchases/{purchase_id}/wait")
def wait_purchase(purchase_id: str):
    with store.connection() as db:
        purchase, resolved = read_purchase(db, purchase_id)
        if resolved:
            raise HTTPException(409, "This decision is already recorded.")
        purchase["wait_until"] = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
        db.execute("UPDATE purchases SET value=? WHERE id=?", (json.dumps(purchase), purchase_id))
        return purchase


@app.get("/api/purchases/pending")
def pending():
    with store.connection() as db:
        return [
            json.loads(r[0])
            for r in db.execute("SELECT value FROM purchases WHERE resolved=0 ORDER BY rowid DESC")
        ]


@app.get("/api/purchases/{purchase_id}")
def get_purchase(purchase_id: str):
    with store.connection() as db:
        purchase, resolved = read_purchase(db, purchase_id)
        purchase["resolved"] = resolved
        return purchase_response(purchase, db)


@app.post("/api/ai/financial-scan")
async def scan():
    with store.connection() as db:
        context = store.snapshot(db)
        unknown = [t for t in store.rows(db, "transactions") if t["category"] == "Other"]
    meta = ai_off()
    classifications = 0
    suggestions = []
    try:
        if not context["transaction_count"]:
            raise HTTPException(400, "Add or import transactions before scanning your spending.")
        if not ai_allowed(context):
            raise AIUnavailable("Gemini is off. Showing patterns calculated from your transactions.")
        if unknown:
            result, _ = await gemini.generate(
                Classifications,
                json.dumps(
                    {
                        "task": "Classify these ambiguous merchants.",
                        "transactions": [{"merchant": t["merchant"]} for t in unknown[:100]],
                    }
                ),
            )
            lookup = {
                r.merchant: r
                for r in result.transactions
                if r.confidence >= 0.8 and r.category not in {"Income", "Savings", "Other"}
            }
            suggestions = [
                {
                    "id": t["id"],
                    "merchant": t["merchant"],
                    "date": t["date"],
                    "amount_cents": t["amount_cents"],
                    "category": lookup[t["merchant"]].category,
                    "normalized_merchant": lookup[t["merchant"]].normalized_merchant,
                    "confidence": lookup[t["merchant"]].confidence,
                }
                for t in unknown
                if t["merchant"] in lookup
            ]
        result, meta = await gemini.generate(
            Insights,
            json.dumps(
                {
                    "task": "Find actionable opportunities. No numeric savings claims in prose.",
                    "context": context,
                }
            ),
        )
        insights = [r.model_dump() for r in result.insights]
    except AIUnavailable as exc:
        meta = ai_off(str(exc))
        insights = [
            {
                "title": "Give recurring charges a second look",
                "description": "Review subscriptions you still use before the next renewal.",
                "category": "Subscriptions",
                "priority": "medium",
                "reason": "Similar monthly charges were found in your transaction history.",
            },
            {
                "title": "Make room for the purchases that matter",
                "description": "A short pause can help separate a useful purchase from a passing impulse.",
                "category": "Shopping",
                "priority": "medium",
                "reason": "Shopping is part of your chosen discretionary budget.",
            },
        ]
        if not context["subscriptions"]:
            insights = [item for item in insights if item["category"] != "Subscriptions"]
    # Estimates are code-calculated scenarios, not model-generated amounts.
    for item in insights:
        total = context["subscription_monthly"] if item["category"] == "Subscriptions" else None
        item["estimated_monthly_savings"] = total
        item["estimate_basis"] = (
            "Maximum if all detected subscriptions are cancelled; not a recommendation to cancel all."
            if total is not None
            else None
        )
    return {
        "ai": meta,
        "insights": insights,
        "classified_count": classifications,
        "suggestions": suggestions,
        "dashboard": context,
    }


@app.post("/api/subscriptions/confirm-cancelled")
def subscription(body: SubscriptionRequest):
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        sub = next(
            (
                s
                for s in engine.recurring(
                    store.rows(db, "transactions"), date.fromisoformat(store.get(db, "profile")["as_of"])
                )
                if s["merchant"] == body.merchant
            ),
            None,
        )
        if not sub:
            raise ValueError("Recurring subscription not found.")
        event_id = "subscription:" + body.merchant.casefold()
        if db.execute("SELECT 1 FROM events WHERE id=? AND active=1", (event_id,)).fetchone():
            raise HTTPException(409, "Cancellation already recorded.")
        amount = engine.cents(sub["monthly"])
        db.execute(
            "INSERT INTO events(id,date,type,amount_cents,recurring_cents,description) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,type=excluded.type,amount_cents=excluded.amount_cents,recurring_cents=excluded.recurring_cents,description=excluded.description,confirmed=0,active=1",
            (
                event_id,
                store.get(db, "profile")["as_of"],
                "subscription_cancelled",
                amount,
                amount,
                f"Confirmed cancellation: {body.merchant}",
            ),
        )
        return {"protected": sub["monthly"], "dashboard": store.snapshot(db)}


@app.get("/api/goals")
def goals():
    with store.connection() as db:
        return store.snapshot(db)["goal"]


@app.post("/api/goals")
def set_goal(body: GoalRequest):
    if not body.name.strip():
        raise ValueError("Give your goal a name.")
    with store.connection() as db:
        profile = store.get(db, "profile")
        protected = sum(
            e["amount_cents"] for e in store.rows(db, "events") if profile.get("demo") or e.get("confirmed")
        )
        saved = positive(body.current_saved, True)
        store.put(
            db,
            "goal",
            {
                "name": body.name.strip(),
                "target_cents": positive(body.target),
                "monthly_cents": positive(body.monthly_contribution, True),
                "initial_cents": saved - protected,
            },
        )
        return store.snapshot(db)["goal"]


@app.get("/api/gambling/status")
def guard(proposed: str = Query("0")):
    amount = positive(proposed, True)
    with store.connection() as db:
        settings = store.get(db, "guard")
        profile = store.get(db, "profile")
        d = store.snapshot(db)
        status = engine.gambling_status(
            store.rows(db, "transactions"),
            settings["limit_cents"],
            date.fromisoformat(profile["as_of"]),
            amount,
        )
        active = bool(
            settings["cooldown_until"]
            and datetime.fromisoformat(settings["cooldown_until"]) > datetime.now(timezone.utc)
        )
        return {
            **status,
            **settings,
            "cooldown_active": active,
            "proposed": engine.dollars(amount),
            "impact": engine.impact(
                amount,
                engine.cents(d["available"]),
                d["goal"]["target_cents"],
                d["goal"]["saved_cents"],
                d["goal"]["monthly_cents"],
                date.fromisoformat(profile["as_of"]),
            ),
        }


@app.post("/api/gambling/settings")
def guard_settings(body: GuardSettings):
    with store.connection() as db:
        settings = store.get(db, "guard")
        settings.update(enabled=body.enabled, limit_cents=positive(body.weekly_limit))
        store.put(db, "guard", settings)
    return guard("0")


@app.post("/api/gambling/cooldown")
def cooldown():
    with store.connection() as db:
        settings = store.get(db, "guard")
        if not settings["enabled"]:
            raise ValueError("Enable Gambling Guard first.")
        settings["cooldown_until"] = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        store.put(db, "guard", settings)
    return guard("0")


@app.get("/api/money-rescued")
def money_rescued():
    with store.connection() as db:
        return engine.rescued(store.rows(db, "events"), date.fromisoformat(store.get(db, "profile")["as_of"]))


# A production frontend build can be served by the same local Python process.
frontend = ROOT / "frontend/dist"
if frontend.exists():
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
