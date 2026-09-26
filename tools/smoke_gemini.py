"""Opt-in live check. Uses only the synthetic demo cart and synthetic context."""

import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv
from backend.models import PurchaseUnderstanding
from backend.services.gemini_service import GeminiService, AIUnavailable

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


async def main():
    service = GeminiService()
    status = await service.status()
    print(json.dumps(status, indent=2))
    try:
        result, meta = await service.generate(
            PurchaseUnderstanding,
            "Extract this synthetic demo product and its USD price. The remaining discretionary budget is 372 USD.",
            (ROOT / "frontend/public/sample-cart.png").read_bytes(),
            "image/png",
        )
        print(
            json.dumps(
                {
                    "model": meta["model"],
                    "product": result.product_name,
                    "detected_price": result.detected_price,
                    "confidence": result.confidence,
                },
                indent=2,
            )
        )
    except AIUnavailable as exc:
        print(str(exc))
        raise SystemExit(2)


if __name__ == "__main__":
    asyncio.run(main())
