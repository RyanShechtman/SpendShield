from datetime import date
import pytest
from backend import engine


def test_money_exactness():
    assert engine.cents("0.10") + engine.cents("0.20") == 30
    assert engine.dollars(12345) == 123.45
    for value in ("nan", "Infinity", "0.001", "10000001", "wat"):
        with pytest.raises(ValueError):
            engine.cents(value)


def test_goal_rounding_and_missing_data():
    assert engine.goal_days(58000, 54000) == 33
    assert engine.goal_days(74000, 54000) == 42
    assert engine.goal_days(0, 0) == 0
    assert engine.goal_days(100, 0) is None
    assert engine.goal_days(1, 3000) == 1
    assert engine.percent(100, 0) is None


def test_purchase_impact():
    result = engine.impact(16000, 37200, 150000, 92000, 54000, date(2026, 9, 26))
    assert result["budget_percent"] == 43.0
    assert result["baseline_days"] == 33
    assert result["buying_days"] == 42
    assert result["delay_days"] == 9
    assert result["baseline_date"] == "2026-10-29"
    assert result["buying_date"] == "2026-11-07"
    assert result["within_budget"]
    result = engine.impact(100, 0, 1000, 0, 0, date(2026, 9, 26))
    assert not result["within_budget"]
    assert result["budget_percent"] is None
    assert result["delay_days"] is None


def test_gambling_week_boundaries():
    rows = [
        {"date": d, "category": "Gambling", "amount_cents": v}
        for d, v in [
            ("2026-09-20", -9000),
            ("2026-09-21", -2500),
            ("2026-09-23", -2000),
            ("2026-09-25", -4000),
            ("2026-09-27", -5000),
        ]
    ]
    result = engine.gambling_status(rows, 10000, date(2026, 9, 26), 4000)
    assert result["spent"] == 85
    assert result["percent"] == 85
    assert result["over_by"] == 25
    assert result["remaining"] == 15
    assert len(result["transactions"]) == 3
    assert engine.gambling_status(rows, 20000, date(2026, 9, 26), 4000)["over_by"] == 0


def test_recurring_requires_distinct_months():
    rows = [
        {"date": d, "category": "Subscriptions", "amount_cents": -999, "merchant": "Music"}
        for d in ("2026-09-01", "2026-09-20")
    ]
    assert engine.recurring(rows) == []
    rows.append({**rows[0], "date": "2026-08-01"})
    assert engine.recurring(rows) == []  # Ambiguous extra charge in one month.
    assert engine.recurring([rows[0], rows[2]])[0]["monthly"] == 9.99
    assert engine.recurring([rows[0], rows[2]], date(2027, 1, 1)) == []


def test_recurring_savings_never_annualizes_one_time():
    result = engine.rescued(
        [
            {"date": "2026-08-31", "amount_cents": 10000, "recurring_cents": 0},
            {"date": "2026-09-01", "amount_cents": 7300, "recurring_cents": 0},
            {"date": "2026-09-04", "amount_cents": 1400, "recurring_cents": 1400},
        ],
        date(2026, 9, 26),
    )
    assert result["this_month"] == 87
    assert result["total"] == 187
    assert result["projected_annual_recurring"] == 168


def test_empty_dashboard_no_division_by_zero():
    result = engine.dashboard(
        [],
        [],
        {"as_of": "2026-09-26", "budget_cents": 0},
        {"target_cents": 150000, "initial_cents": 0, "monthly_cents": 0},
    )
    assert result["income"] == 0
    assert result["savings_rate"] is None
    assert result["goal"]["date"] is None
    assert result["available"] == 0
