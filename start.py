r"""Launch the installed local app with: .venv\Scripts\python start.py."""

import argparse
import json
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description="Start SpendShield on this computer.")
    parser.add_argument(
        "--no-browser", action="store_true", help="Start the server without opening a browser"
    )
    args = parser.parse_args()
    if not (ROOT / "frontend/dist/index.html").exists():
        raise SystemExit(
            "Build the interface first: cd frontend, then pnpm install and pnpm run build. See README.md."
        )
    url = "http://127.0.0.1:8000"

    def ready():
        try:
            with urllib.request.urlopen(url + "/api/health", timeout=1) as response:
                return json.load(response).get("product") == "SpendShield"
        except (OSError, ValueError, urllib.error.URLError):
            return False

    if ready():
        print(f"SpendShield is already running at {url}")
        if not args.no_browser:
            webbrowser.open(url)
        return

    def open_when_ready():
        for _ in range(40):
            if ready():
                webbrowser.open(url)
                return
            time.sleep(0.25)

    if not args.no_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()
    print(f"SpendShield: {url}\nKeep this window open while using the app. Press Ctrl+C to stop.")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, app_dir=str(ROOT))


if __name__ == "__main__":
    main()
