"""Rebuild the synthetic cart PNG and sample CSV; no remote images or trademarks."""

import csv
import io
from pathlib import Path
from tempfile import TemporaryDirectory
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend/public"
OUT.mkdir(parents=True, exist_ok=True)


def font(size, bold=False):
    candidates = [
        Path("C:/Windows/Fonts/" + ("segoeuib.ttf" if bold else "segoeui.ttf")),
        Path("/usr/share/fonts/truetype/dejavu/" + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


image = Image.new("RGB", (1100, 780), "#f4f6f0")
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((45, 40, 1055, 740), radius=24, fill="white", outline="#dce3d7", width=2)
draw.text((90, 76), "AERO / DEMO STORE", font=font(22, True), fill="#526344")
draw.text((90, 145), "Your shopping bag", font=font(42, True), fill="#253b2a")
draw.line((90, 221, 1010, 221), fill="#e0e6d8", width=2)
draw.rounded_rectangle((90, 256, 315, 459), radius=18, fill="#e8efdc")
draw.text((119, 310), "AERO", font=font(38, True), fill="#82996b")
draw.text((124, 365), "RUN / 01", font=font(21), fill="#8da376")
draw.text((353, 270), "Aero Run", font=font(36, True), fill="#2a412d")
draw.text((353, 321), "Everyday running shoes", font=font(27), fill="#67785b")
draw.text((353, 373), "Color: Moss  |  Size: US 9  |  Qty: 1", font=font(20), fill="#91a181")
draw.text((824, 281), "$160.00", font=font(30, True), fill="#2a412d")
draw.line((90, 496, 1010, 496), fill="#e0e6d8", width=2)
draw.text((90, 530), "Order total (USD)", font=font(28), fill="#566b48")
draw.text((815, 522), "$160.00", font=font(34, True), fill="#2a412d")
draw.text((90, 595), "Synthetic shopping cart for the SpendShield demo.", font=font(19), fill="#95a287")
draw.text((90, 625), "Illustrative price. No real store or checkout.", font=font(19), fill="#95a287")
image.save(OUT / "sample-cart.png")

with TemporaryDirectory() as temp:
    old = os.environ.get("SPENDSHIELD_DB")
    os.environ["SPENDSHIELD_DB"] = str(Path(temp) / "seed.sqlite3")
    from backend import store

    store.init()
    with store.connection() as db:
        store.reset(db)
        rows = store.rows(db, "transactions")
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(["date", "merchant", "amount", "category"])
    for r in sorted(rows, key=lambda r: r["date"]):
        writer.writerow([r["date"], r["merchant"], f"{r['amount_cents'] / 100:.2f}", r["category"]])
    for output in (OUT / "sample-transactions.csv", ROOT / "data/demo-transactions.csv"):
        output.write_text(buffer.getvalue(), encoding="utf-8")
    if old is None:
        os.environ.pop("SPENDSHIELD_DB", None)
    else:
        os.environ["SPENDSHIELD_DB"] = old
print("Generated sample-cart.png and demo transaction CSVs.")
