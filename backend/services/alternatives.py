import json
from pathlib import Path
from typing import Protocol
from backend.engine import cents, dollars


class AlternativeProvider(Protocol):
    def search(self, product: str, category: str, price_cents: int) -> list[dict]: ...


class DemoCatalogProvider:
    def __init__(self):
        self.products = json.loads((Path(__file__).resolve().parents[1] / "assets/products.json").read_text())

    def search(self, product, category, price_cents):
        return [
            {**p, "source": "Demo catalog result", "savings": dollars(price_cents - cents(p["price"]))}
            for p in self.products
            if p["category"] == category
            and cents(p["price"]) < price_cents
            and any(k in product.lower() for k in p["keywords"])
        ][:3]
