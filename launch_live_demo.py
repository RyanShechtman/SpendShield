"""Run an isolated judge profile; never opens or resets the personal database."""
import os
import sys
import webbrowser
from pathlib import Path
from datetime import date
import uvicorn
root=Path(__file__).resolve().parent
os.environ["SPENDSHIELD_DB"]=str(root/"data/live-demo.sqlite3")
os.environ["SPENDSHIELD_MODE"]="local"
os.environ["SPENDSHIELD_LIVE_DEMO"]="1"
from backend import store
store.init()
with store.connection() as db:
    if "--reset" in sys.argv:
        store.fresh_profile(db)
    if not store.get(db,"profile")["onboarded"]:
        p=store.get(db,"profile");p.update(name="Alex",first_name="Alex",onboarded=True,budget_cents=46500,ai_enabled=False);store.put(db,"profile",p)
        store.put(db,"goal",{"name":"Emergency fund","target_cents":150000,"initial_cents":113000,"monthly_cents":60000})
        store.put(db,"guard",{"enabled":True,"limit_cents":10000,"cooldown_until":None})
        db.execute("INSERT INTO transactions(date,merchant,amount_cents,category) VALUES(?,?,?,?)",(str(date.today()),"Fictional prior gambling spending",-8400,"Gambling"))
print("ISOLATED LIVE DEMO: http://127.0.0.1:8002 — personal finances are untouched.")
if not os.getenv("SPENDSHIELD_NO_BROWSER"):webbrowser.open("http://127.0.0.1:8002")
uvicorn.run("backend.main:app",host="127.0.0.1",port=8002,log_level="warning")
