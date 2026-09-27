"""Start the local Python API and Vite frontend together: python dev.py."""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parent
manager = shutil.which("pnpm") or shutil.which("npm")
if not manager:
    raise SystemExit("Install Node.js (npm) or pnpm first. See README.md.")
processes = []
try:
    processes.append(
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=root,
        )
    )
    command = [manager, "run", "dev"]
    processes.append(subprocess.Popen(command, cwd=root / "frontend", shell=os.name == "nt"))
    print("\nSpendShield: http://127.0.0.1:5173\nPress Ctrl+C to stop both servers.\n", flush=True)
    while all(p.poll() is None for p in processes):
        time.sleep(0.5)
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        if process.poll() is None:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                process.terminate()
