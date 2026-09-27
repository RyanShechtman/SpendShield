import { useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Target,
  UserRound,
  Wallet,
} from "lucide-react";
import { api, post, money, hostedMode } from "./api";
import type { Dashboard, Transaction } from "./types";

export function Onboarding({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    name: "",
    budget: "",
    goal_name: "Emergency fund",
    goal_target: "",
    goal_saved: "0",
    goal_monthly: "",
    ai_enabled: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: string, value: string | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <div className="onboarding">
      <a className="brand" href="/">
        <span className="brand-mark">
          <ShieldCheck />
        </span>
        SpendShield.
      </a>
      <div className="setup-shell">
        <aside className="setup-story">
          <span className="overline">THINK BEFORE YOU SPEND.</span>
          <h1>
            Make room for <br />
            what matters <br />
            <em>to you.</em>
          </h1>
          <p>
            A personal spending plan that helps you see how today's choices
            affect the goal you're building.
          </p>
          <ol>
            {[
              "Make it yours",
              "Set a spending boundary",
              "Choose your first goal",
            ].map((s, i) => (
              <li
                key={s}
                className={step === i ? "current" : step > i ? "complete" : ""}
              >
                <span>{step > i ? <Check size={16} /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <small>
            {hostedMode
              ? "Saved to your private account."
              : "Stored on this computer."}{" "}
            Optional Gemini insights. USD only.
          </small>
        </aside>
        <section className="setup-form">
          <span className="setup-step">STEP {step + 1} OF 3</span>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (step < 2) {
                setStep(step + 1);
                return;
              }
              setBusy(true);
              try {
                await post("/profile/setup", {
                  ...values,
                  name: values.name.trim(),
                  budget: values.budget || "0",
                  goal_monthly: values.goal_monthly || "0",
                });
                await onComplete();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {step === 0 && (
              <>
                <UserRound className="section-icon" />
                <h2>What should we call you?</h2>
                <p>Use your preferred name. You can change it anytime.</p>
                <label>
                  Your name
                  <input
                    autoFocus
                    autoComplete="given-name"
                    value={values.name}
                    maxLength={80}
                    required
                    pattern=".*\S.*"
                    placeholder="e.g. Maya"
                    onChange={(e) => update("name", e.target.value)}
                  />
                </label>
                <div className="setup-detail">
                  <ShieldCheck size={20} />
                  <p>
                    No bank login required. Start with your own entries or
                    import a statement after setup.
                  </p>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <Wallet className="section-icon" />
                <h2>Give everyday spending a limit.</h2>
                <p>
                  How much do you want to spend each month on shopping, dining
                  out, entertainment and other nonessential purchases?
                </p>
                <label>
                  Monthly spending budget (USD)
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.budget}
                    placeholder="e.g. 500"
                    onChange={(e) => update("budget", e.target.value)}
                  />
                </label>
                <div className="setup-detail">
                  <p>
                    Leave rent, groceries, transport, subscriptions and savings
                    out of this number. Not sure yet? Leave it blank and set it
                    later in Settings.
                  </p>
                </div>
                <p className="fine-print">
                  Your budget is a limit you choose, not a bank balance.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <Target className="section-icon" />
                <h2>What are you saving for?</h2>
                <p>
                  Start with one goal. We'll show what a purchase means for your
                  progress.
                </p>
                <label>
                  Goal name
                  <input
                    value={values.goal_name}
                    maxLength={80}
                    required
                    pattern=".*\S.*"
                    onChange={(e) => update("goal_name", e.target.value)}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Goal amount (USD)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={values.goal_target}
                      placeholder="e.g. 1500"
                      required
                      onChange={(e) => update("goal_target", e.target.value)}
                    />
                  </label>
                  <label>
                    Already saved (USD)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.goal_saved}
                      required
                      onChange={(e) => update("goal_saved", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Monthly savings plan (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.goal_monthly}
                    placeholder="e.g. 100"
                    onChange={(e) => update("goal_monthly", e.target.value)}
                  />
                </label>
                <p className="fine-print">
                  Leave the monthly plan blank if you aren't ready to estimate a
                  completion date.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={values.ai_enabled}
                    onChange={(e) => update("ai_enabled", e.target.checked)}
                  />
                  <span>
                    Enable Gemini insights and image reading
                    <small>
                      When you use these features, relevant spending context and
                      uploaded images are sent to Google. You can turn this off
                      in Settings.
                    </small>
                  </span>
                </label>
              </>
            )}
            {error && (
              <p className="modal-error" role="alert">
                {error}
              </p>
            )}
            <div className="setup-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              <button className="primary" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : null}
                {step === 2 ? "Open my dashboard" : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export function ProfileSettings({
  data,
  onSaved,
  onBudget,
  onGoal,
  onRestore,
}: {
  data: Dashboard;
  onSaved: () => Promise<void>;
  onBudget: () => void;
  onGoal: () => void;
  onRestore: () => void;
}) {
  const [name, setName] = useState(data.profile.name);
  const [ai, setAi] = useState(data.profile.ai_enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <UserRound className="section-icon" />
      <h2>Your settings</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await post("/profile", { name: name.trim(), ai_enabled: ai });
            await onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your name
          <input
            autoComplete="given-name"
            value={name}
            maxLength={80}
            required
            pattern=".*\S.*"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={ai}
            onChange={(e) => setAi(e.target.checked)}
          />
          <span>
            Use Gemini for insights
            <small>
              Allows relevant financial context, purchase details and images to
              be sent to Google when you request AI analysis. Calculations also
              work without AI.
            </small>
          </span>
        </label>
        <button className="primary full" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        {error && (
          <p role="alert" className="modal-error">
            {error}
          </p>
        )}
      </form>
      {hostedMode && (
        <button
          className="secondary full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await post("/auth/logout");
              window.dispatchEvent(new Event("spendshield:signed-out"));
            } catch {
              setError("Could not sign out. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign out
        </button>
      )}
      <div className="settings-links">
        <button onClick={onBudget}>
          <Wallet size={18} />
          <span>
            Spending budget<small>{money(data.budget)} per month</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <button onClick={onGoal}>
          <Target size={18} />
          <span>
            Savings goal<small>{data.goal.name}</small>
          </span>
          <ArrowRight size={16} />
        </button>
        <a href="/api/profile/export" download>
          <Download size={18} />
          <span>
            Download my data
            <small>Profile, transactions, decisions and preferences</small>
          </span>
          <ArrowRight size={16} />
        </a>
        <button onClick={onRestore}>
          <Download size={18} />
          <span>
            Restore a backup
            <small>Preview a JSON backup or undo the last restore</small>
          </span>
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="setup-detail">
        <p>
          {hostedMode ? (
            <>
              Your records are saved to your signed-in account on the server.
              Other visitors have separate profiles. Gemini receives relevant
              context only when you opt in and request AI analysis.
            </>
          ) : (
            <>
              <strong>One private space on this computer.</strong> This version
              saves one person's profile locally. Anyone with access to this
              running app can view this profile.
            </>
          )}{" "}
          SpendShield does not connect to a bank or move money. Keep a
          downloaded backup of important records.
        </p>
      </div>
    </>
  );
}

export function TransactionEditor({
  transaction,
  onSaved,
}: {
  transaction: Transaction | null;
  onSaved: () => Promise<void>;
}) {
  const localDate = new Date().toLocaleDateString("en-CA");
  const [values, setValues] = useState({
    date: transaction?.date || localDate,
    merchant: transaction?.merchant || "",
    amount: transaction ? String(Math.abs(transaction.amount_cents) / 100) : "",
    category: transaction?.category || "Shopping",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  async function save(remove = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (remove && transaction)
        await api("/transactions/" + transaction.id, { method: "DELETE" });
      else if (transaction)
        await api("/transactions/" + transaction.id, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      else await post("/transactions", values);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Wallet className="section-icon" />
      <h2>{transaction ? "Edit transaction" : "Add a transaction"}</h2>
      <p>
        Record money that already came in or went out. Use Purchase Shield for a
        purchase you're still considering.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Merchant or description
          <input
            autoFocus
            required
            maxLength={160}
            value={values.merchant}
            onChange={(e) => setValues({ ...values, merchant: e.target.value })}
            placeholder="e.g. Grocery store"
          />
        </label>
        <div className="form-row">
          <label>
            Amount (USD)
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={values.amount}
              onChange={(e) => setValues({ ...values, amount: e.target.value })}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              max={localDate}
              required
              value={values.date}
              onChange={(e) => setValues({ ...values, date: e.target.value })}
            />
          </label>
        </div>
        <label>
          Category
          <select
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value })}
          >
            {[
              "Income",
              "Rent",
              "Groceries",
              "Restaurants",
              "Transportation",
              "Subscriptions",
              "Entertainment",
              "Shopping",
              "Gambling",
              "Savings",
              "Other",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <p className="fine-print">
          Enter a positive amount. Income is money in; other categories are
          money out. Savings entries track transfers, while your goal balance is
          managed separately.
        </p>
        <button className="primary full" disabled={busy}>
          {busy ? "Saving…" : transaction ? "Save changes" : "Add transaction"}
        </button>
      </form>
      {transaction && (
        <div className="delete-choice">
          {removing ? (
            <>
              <p>
                Remove this transaction? Your spending totals will be
                recalculated.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Remove transaction
              </button>
              <button className="text-link" onClick={() => setRemoving(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="text-link" onClick={() => setRemoving(true)}>
              Remove this transaction
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="modal-error">
          {error}
        </p>
      )}
    </>
  );
}

type Preview = {
  count: number;
  new_count: number;
  skipped: number;
  from: string;
  to: string;
  sample: Transaction[];
};
export function ImportTransactions({
  onSaved,
}: {
  onSaved: (message: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <FileSpreadsheet className="section-icon" />
      <h2>Import your transactions</h2>
      <p>
        Use a CSV with the columns shown below. Your name, budget, goal and
        existing decisions stay intact.
      </p>
      <a className="text-link" href="/transaction-template.csv" download>
        Download an empty CSV template <Download size={15} />
      </a>
      <details className="csv-help">
        <summary>What should the CSV look like?</summary>
        <p>
          Required headers: <code>date,merchant,amount</code>. Optional:{" "}
          <code>category</code>. Dates use YYYY-MM-DD; income is positive and
          expenses are negative, in USD.
        </p>
        <pre>
          date,merchant,amount,category{"\n"}2026-09-20,Grocery
          store,-42.50,Groceries
        </pre>
        <p>Refunds aren't supported. Use UTF-8, up to 2 MB and 5,000 rows.</p>
      </details>
      <label className="upload-zone">
        <FileSpreadsheet />
        <strong>{file?.name || "Choose a CSV file"}</strong>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            if (!selected) return;
            setFile(selected);
            setPreview(null);
            setError("");
            setBusy(true);
            try {
              const form = new FormData();
              form.append("file", selected);
              setPreview(
                await api<Preview>("/transactions/preview", {
                  method: "POST",
                  body: form,
                }),
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to read this file.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && !preview && <p role="status">Checking your file…</p>}
      {preview && (
        <div className="import-preview">
          <h3>
            {preview.new_count} new{" "}
            {preview.new_count === 1 ? "transaction" : "transactions"}
          </h3>
          <p>
            {preview.from} to {preview.to}
          </p>
          <p>
            {preview.skipped} duplicate {preview.skipped === 1 ? "row" : "rows"}{" "}
            will be skipped. A duplicate has the same date, merchant and amount.
            Add any genuinely identical purchases manually.
          </p>
          <ul>
            {preview.sample.map((t, i) => (
              <li key={i}>
                <span>{t.merchant}</span>
                <strong>{money(t.amount_cents / 100, true)}</strong>
              </li>
            ))}
          </ul>
          <button
            className="primary full"
            disabled={busy || preview.new_count === 0}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.append("file", file);
                const result = await api<{ count: number; skipped: number }>(
                  "/transactions/upload",
                  { method: "POST", body: form },
                );
                await onSaved(
                  `Added ${result.count} ${result.count === 1 ? "transaction" : "transactions"}. Skipped ${result.skipped} ${result.skipped === 1 ? "duplicate" : "duplicates"}.`,
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Importing…"
              : `Import ${preview.new_count} ${preview.new_count === 1 ? "transaction" : "transactions"}`}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="modal-error">
          {error}
        </p>
      )}
    </>
  );
}
