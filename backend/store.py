import json
import os
import sqlite3
from contextlib import contextmanager
from contextvars import ContextVar
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
user_context = ContextVar("spendshield_user", default=None)


@contextmanager
def connection():
    if os.getenv("SPENDSHIELD_MODE") == "hosted":
        user = user_context.get()
        if not user or not re.fullmatch(r"[a-f0-9]{64}", user):
            raise RuntimeError("An authenticated account is required for hosted storage.")
        path = Path(os.environ["SPENDSHIELD_DATA_DIR"]) / "users" / f"{user}.sqlite3"
    else:
        path = Path(os.getenv("SPENDSHIELD_DB", str(ROOT / "data/spendshield.sqlite3")))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()


def init():
    with connection() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT NOT NULL,
          merchant TEXT NOT NULL, amount_cents INTEGER NOT NULL, category TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, date TEXT NOT NULL, type TEXT NOT NULL,
          amount_cents INTEGER NOT NULL CHECK(amount_cents>0), recurring_cents INTEGER NOT NULL DEFAULT 0,
          description TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, value TEXT NOT NULL, resolved INTEGER DEFAULT 0);
        """)
        if not db.execute("SELECT 1 FROM settings WHERE key='profile'").fetchone():
            fresh_profile(db)
        columns = {r[1] for r in db.execute("PRAGMA table_info(events)")}
        if "confirmed" not in columns:
            db.execute("ALTER TABLE events ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0")
        if "active" not in columns:
            db.execute("ALTER TABLE events ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
        if not db.execute("SELECT 1 FROM settings WHERE key='personal_version'").fetchone():
            profile = get(db, "profile")
            if profile.get("demo"):
                # Preserve the previous synthetic session without mixing it into personal finances.
                backup = {
                    "profile": profile,
                    "goal": get(db, "goal"),
                    "transactions": rows(db, "transactions"),
                    "events": rows(db, "events"),
                    "purchases": [dict(r) for r in db.execute("SELECT * FROM purchases")],
                    "guard": get(db, "guard"),
                }
                fresh_profile(db)
                put(db, "previous_sample_backup", backup)
            else:
                profile.setdefault("onboarded", False)
                profile.setdefault("ai_enabled", False)
                put(db, "profile", profile)
            put(db, "personal_version", 1)


def get(db, key):
    value = json.loads(db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()[0])
    if key == "profile" and not value.get("demo"):
        value["as_of"] = str(date.today())
    return value


def fresh_profile(db):
    for table in ("transactions", "events", "purchases"):
        db.execute(f"DELETE FROM {table}")
    put(
        db,
        "profile",
        {
            "name": "",
            "first_name": "there",
            "role": "Personal profile",
            "as_of": str(date.today()),
            "demo": False,
            "onboarded": False,
            "ai_enabled": False,
            "budget_cents": 0,
        },
    )
    put(db, "goal", {"name": "Emergency fund", "target_cents": 0, "initial_cents": 0, "monthly_cents": 0})
    put(db, "guard", {"enabled": False, "limit_cents": 10000, "cooldown_until": None})


def put(db, key, value):
    db.execute("INSERT OR REPLACE INTO settings VALUES (?, ?)", (key, json.dumps(value)))


def rows(db, table):
    if table not in {"transactions", "events"}:
        raise ValueError("Unknown table")
    where = " WHERE active=1" if table == "events" else ""
    return [dict(r) for r in db.execute(f"SELECT * FROM {table}{where} ORDER BY date DESC, rowid DESC")]


def reset(db):
    for table in ("transactions", "events", "purchases", "settings"):
        db.execute(f"DELETE FROM {table}")
    put(
        db,
        "profile",
        {
            "name": "Alex Morgan",
            "first_name": "Alex",
            "role": "Graduate student · Baltimore, MD",
            "as_of": "2026-09-26",
            "demo": True,
            "budget_cents": 95000,
        },
    )
    put(
        db,
        "goal",
        {"name": "Emergency fund", "target_cents": 150000, "initial_cents": 70600, "monthly_cents": 54000},
    )
    put(db, "guard", {"enabled": False, "limit_cents": 10000, "cooldown_until": None})
    current = [
        (1, "Campus research payroll", 160000, "Income"),
        (15, "Campus research payroll", 160000, "Income"),
        (1, "Campus apartment", -110000, "Rent"),
        (3, "Trader Joe's", -7800, "Groceries"),
        (10, "Giant Food", -9200, "Groceries"),
        (17, "Trader Joe's", -6100, "Groceries"),
        (24, "Giant Food", -4900, "Groceries"),
        (2, "MTA monthly pass", -7700, "Transportation"),
        (18, "Lyft", -1800, "Transportation"),
        (4, "Spotify", -1199, "Subscriptions"),
        (8, "Netflix", -1799, "Subscriptions"),
        (12, "Cloud storage", -1399, "Subscriptions"),
        (3, "Local coffee", -1850, "Restaurants"),
        (7, "Sweetgreen", -2450, "Restaurants"),
        (11, "Noodle house", -4200, "Restaurants"),
        (16, "Takeout night", -5800, "Restaurants"),
        (22, "Campus café", -4500, "Restaurants"),
        (5, "Campus bookstore", -6500, "Shopping"),
        (19, "Everyday clothing", -10000, "Shopping"),
        (6, "Movie night", -3400, "Entertainment"),
        (13, "Concert tickets", -7800, "Entertainment"),
        (20, "Weekend outing", -2800, "Entertainment"),
        (21, "Sportsbook deposit", -2500, "Gambling"),
        (23, "Sportsbook deposit", -2000, "Gambling"),
        (25, "Sportsbook deposit", -4000, "Gambling"),
        (15, "Savings transfer", -30000, "Savings"),
    ]
    previous = [
        (1, "Campus apartment", -110000, "Rent"),
        (1, "Campus research payroll", 160000, "Income"),
        (15, "Campus research payroll", 160000, "Income"),
        (4, "Spotify", -1199, "Subscriptions"),
        (8, "Netflix", -1799, "Subscriptions"),
        (12, "Cloud storage", -1399, "Subscriptions"),
        (5, "Trader Joe's", -8300, "Groceries"),
        (12, "Giant Food", -7200, "Groceries"),
        (20, "Trader Joe's", -9000, "Groceries"),
        (27, "Giant Food", -6500, "Groceries"),
        (2, "MTA monthly pass", -7700, "Transportation"),
        (15, "Savings transfer", -30000, "Savings"),
    ]
    for day in (3, 7, 11, 16, 20, 24, 29):
        previous.append((day, "Local dining", -2500 - day * 20, "Restaurants"))
    previous += [
        (9, "Weekend cinema", -3600, "Entertainment"),
        (22, "Museum and dinner", -6000, "Entertainment"),
        (17, "Campus supplies", -9700, "Shopping"),
        (28, "Sportsbook deposit", -3000, "Gambling"),
    ]
    for month, entries in ((8, previous), (9, current)):
        for day, merchant, amount, category in entries:
            db.execute(
                "INSERT INTO transactions(date,merchant,amount_cents,category) VALUES(?,?,?,?)",
                (str(date(2026, month, day)), merchant, amount, category),
            )
    db.execute(
        "INSERT INTO events(id,date,type,amount_cents,recurring_cents,description) VALUES(?,?,?,?,?,?)",
        ("seed-skip", "2026-09-10", "purchase_skipped", 20000, 0, "Passed on a tablet upgrade"),
    )
    db.execute(
        "INSERT INTO events(id,date,type,amount_cents,recurring_cents,description) VALUES(?,?,?,?,?,?)",
        (
            "seed-sub",
            "2026-09-18",
            "subscription_cancelled",
            1400,
            1400,
            "Confirmed cancellation of a separate fitness app",
        ),
    )


def snapshot(db):
    from .engine import dashboard

    return dashboard(rows(db, "transactions"), rows(db, "events"), get(db, "profile"), get(db, "goal"))
