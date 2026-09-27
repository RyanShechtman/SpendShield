"""Build a Pages entry point containing only the public hosted-app URL."""

import html
import os
from pathlib import Path
from urllib.parse import urlsplit

url = os.environ.get("PUBLIC_APP_URL", "").strip().rstrip("/")
parsed = urlsplit(url)
if (
    parsed.scheme != "https"
    or not parsed.hostname
    or parsed.username
    or parsed.password
    or parsed.query
    or parsed.fragment
    or parsed.path
    or parsed.port not in (None, 443)
):
    raise SystemExit("Set the PUBLIC_APP_URL repository variable to your HTTPS hosted-app origin.")
target = html.escape(url + "/", quote=True)
out = Path("pages-build")
out.mkdir(exist_ok=True)
(out / "index.html").write_text(
    f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url={target}">
<title>Open SpendShield</title><style>body{{font:18px system-ui;background:#f5f8f4;color:#194d40;max-width:36rem;margin:15vh auto;padding:24px}}a{{color:inherit;font-weight:700}}</style></head>
<body><h1>SpendShield</h1><p>Opening your private financial space…</p><p><a href="{target}">Continue to SpendShield</a></p><p>Think before you spend.</p></body></html>''',
    encoding="utf-8",
)
(out / ".nojekyll").touch()
