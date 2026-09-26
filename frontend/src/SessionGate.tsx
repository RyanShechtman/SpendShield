import { useEffect, useState } from "react";
import { ShieldCheck, Github, LoaderCircle } from "lucide-react";
import { api, setHostedMode } from "./api";
import App from "./App";

export function SessionGate() {
  const [state, setState] = useState<"loading" | "ready" | "login" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ hosted: boolean; authenticated: boolean }>("/auth/session")
      .then((s) => {
        if (!active) return;
        setHostedMode(s.hosted);
        setState(s.authenticated ? "ready" : "login");
      })
      .catch(() => {
        if (active) setState("error");
      });
    const signedOut = () => setState("login");
    window.addEventListener("spendshield:signed-out", signedOut);
    return () => {
      active = false;
      window.removeEventListener("spendshield:signed-out", signedOut);
    };
  }, [attempt]);
  if (state === "ready") return <App />;
  return (
    <main className="sign-in-shell">
      <section className="card sign-in-card">
        <div className="brand">
          <ShieldCheck /> SpendShield.
        </div>
        <span className="overline">THINK BEFORE YOU SPEND</span>
        <h1>Make room for what matters.</h1>
        <p>
          See how a purchase changes your savings goal, compare your options,
          and track what you set aside.
        </p>
        {state === "loading" ? (
          <p role="status">
            <LoaderCircle className="spin" size={20} /> Opening your space…
          </p>
        ) : state === "error" ? (
          <>
            <p role="alert">
              We couldn’t reach SpendShield. Check your connection and try
              again.
            </p>
            <button
              className="primary full"
              onClick={() => {
                setState("loading");
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            {new URLSearchParams(window.location.search).has("signin") && (
              <p role="alert">Sign-in wasn’t completed. Please try again.</p>
            )}
            <a className="primary full" href="/auth/login">
              <Github size={20} /> Continue with GitHub
            </a>
            <p className="sign-in-detail">
              Use your GitHub account to keep your records separate and return
              on another device. We don’t request access to your repositories.
            </p>
            <p className="sign-in-detail">
              Gemini is optional. When enabled, requested AI analysis sends
              relevant purchase details and financial context to Google. You
              never need to enter an API key.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
