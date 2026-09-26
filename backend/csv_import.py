import csv
import io
from datetime import date
from .engine import CATEGORIES, cents


def parse_csv(content: bytes):
    if len(content) > 2_000_000:
        raise ValueError("CSV must be under 2 MB.")
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        if not reader.fieldnames or not {"date", "merchant", "amount"}.issubset(reader.fieldnames):
            raise ValueError("CSV needs date, merchant, amount headers; category is optional.")
        result = []
        for index, row in enumerate(reader, start=2):
            if index > 5001:
                raise ValueError("CSV may contain at most 5,000 transactions.")
            try:
                when = date.fromisoformat(row["date"].strip())
                if when > date.today():
                    raise ValueError("Future transactions are not supported.")
                merchant = row["merchant"].strip()
                if not merchant or len(merchant) > 160:
                    raise ValueError("Merchant must contain 1–160 characters.")
                amount = cents(row["amount"].strip())
                if amount == 0:
                    raise ValueError("A transaction amount cannot be zero.")
                category = (row.get("category") or "").strip().title()
                category = category if category in CATEGORIES else ("Income" if amount > 0 else "Other")
                if amount > 0 and category != "Income":
                    raise ValueError(
                        "Positive amounts must be Income; refunds are not supported in this CSV format."
                    )
                if amount < 0 and category == "Income":
                    raise ValueError("Income must be positive.")
                result.append(
                    {"date": str(when), "merchant": merchant, "amount_cents": amount, "category": category}
                )
            except (ValueError, AttributeError, KeyError) as exc:
                raise ValueError(f"Row {index}: {exc}") from exc
        if not result:
            raise ValueError("CSV contains no transactions.")
        return result
    except (UnicodeDecodeError, csv.Error) as exc:
        raise ValueError("Use a valid UTF-8 CSV file.") from exc
