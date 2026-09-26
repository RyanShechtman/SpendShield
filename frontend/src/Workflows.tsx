import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRight,
  Check,
  Clock3,
  FileJson,
  RotateCcw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { api, money, post } from "./api";
import type { Purchase, Impact, Scan } from "./types";

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";

export function SavedChecks({
  revision,
  onOpen,
  onChange,
}: {
  revision: number;
  onOpen: (id: string) => void;
  onChange: () => Promise<void>;
}) {
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ items: Purchase[]; total: number }>({
    items: [],
    total: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<{ items: Purchase[]; total: number }>(
        `/purchase-history?status=${status}&offset=${offset}&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => {
          setResult(r);
          setError("");
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorText(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision, status, offset, q]);
  async function archive(id: string) {
    setBusy(true);
    try {
      await post(`/purchases/${id}/archive`, { archived: status === "active" });
      setOffset(0);
      await onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card saved-checks">
      <div className="card-heading">
        <div>
          <h2>Saved purchase checks</h2>
          <p>Revisit a decision or archive a check you no longer need.</p>
        </div>
        <Clock3 size={19} />
      </div>
      <div className="segmented" aria-label="Purchase check status">
        {["active", "archived"].map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setOffset(0);
            }}
          >
            {s === "active" ? "To consider" : "Archived"}
          </button>
        ))}
      </div>
      <label className="search-label">
        <Search size={16} />
        <input
          aria-label="Search saved checks"
          placeholder="Find a purchase…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {loading ? (
        <p role="status">Loading checks…</p>
      ) : result.items.length ? (
        result.items.map((p) => (
          <div className="saved-check" key={p.id}>
            <div>
              <strong>{p.product_name}</strong>
              <span>
                {p.detected_price === null
                  ? "Price needed"
                  : money(p.detected_price, true)}
                {p.target_price_cents
                  ? ` · Target ${money(p.target_price_cents / 100, true)}`
                  : ""}
              </span>
              {p.wait_until && (
                <small
                  className={
                    Date.parse(p.wait_until) <= Date.now() ? "due-label" : ""
                  }
                >
                  {Date.parse(p.wait_until) <= Date.now()
                    ? "Ready to revisit"
                    : `Revisit ${new Date(p.wait_until).toLocaleString()}`}
                </small>
              )}
            </div>
            <div className="compact-actions">
              {status === "active" && (
                <button
                  className="text-link"
                  disabled={busy}
                  aria-label={`Review ${p.product_name}`}
                  onClick={() => onOpen(p.id)}
                >
                  Review <ArrowRight size={14} />
                </button>
              )}
              <button
                className="text-link"
                disabled={busy}
                aria-label={`${status === "active" ? "Archive" : "Restore"} ${p.product_name}`}
                onClick={() => void archive(p.id)}
              >
                {status === "active" ? (
                  <Archive size={15} />
                ) : (
                  <RotateCcw size={15} />
                )}
                {status === "active" ? "Archive" : "Restore"}
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="empty-note">
          {q
            ? "No matching checks. Try a different name."
            : status === "archived"
              ? "Archived checks appear here. You can restore them anytime."
              : "Your purchase checks will be saved here automatically."}
        </p>
      )}
      {result.total > 10 && (
        <div className="pagination">
          <button
            className="secondary"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - 10))}
          >
            Previous
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 10, result.total)} of {result.total}
          </span>
          <button
            className="secondary"
            disabled={offset + 10 >= result.total || loading}
            onClick={() => setOffset(offset + 10)}
          >
            Next
          </button>
        </div>
      )}
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function PurchaseTools({
  purchase,
  onSaved,
}: {
  purchase: Purchase;
  onSaved: () => Promise<void>;
}) {
  const price = purchase.detected_price ?? 0;
  const [scenarioPrice, setScenarioPrice] = useState(String(price));
  const [impact, setImpact] = useState<
    (Impact & { difference: number; days_kept: number | null }) | null
  >(null);
  const [target, setTarget] = useState(
    purchase.target_price_cents && purchase.target_price_cents < price * 100
      ? String(purchase.target_price_cents / 100)
      : "",
  );
  const [hours, setHours] = useState(
    String(
      Math.max(
        1,
        Math.min(
          168,
          purchase.reminder_hours ?? (purchase.cooldown_recommendation || 48),
        ),
      ),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (Number(scenarioPrice) === price && purchase.impact) {
      setImpact({ ...purchase.impact, difference: 0, days_kept: 0 });
      return;
    }
    const controller = new AbortController();
    setImpact(null);
    const timer = setTimeout(() => {
      api<Impact & { difference: number; days_kept: number | null }>(
        "/purchase-scenario?price=" +
          encodeURIComponent(scenarioPrice || "0") +
          "&original_price=" +
          encodeURIComponent(price),
        { signal: controller.signal },
      )
        .then(setImpact)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorText(e));
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scenarioPrice, price, purchase.impact]);
  const queries = (
    purchase.alternative_queries?.length
      ? purchase.alternative_queries
      : [
          `${purchase.product_name} refurbished`,
          `${purchase.product_name} lower cost alternatives`,
        ]
  ).slice(0, 3);
  return (
    <>
      <section className="card scenario-card">
        <div className="card-heading">
          <div>
            <span className="overline">TRY A DIFFERENT PRICE</span>
            <h2>What if you spent less?</h2>
          </div>
          <Target size={21} />
        </div>
        <p>
          Move the slider to compare a lower price with buying at{" "}
          {money(price, true)}. This preview does not change your records.
        </p>
        <label className="scenario-price">
          Compare price (USD)
          <input
            aria-label="Compare price (USD)"
            type="number"
            min="0"
            max={price}
            step="0.01"
            value={scenarioPrice}
            onChange={(e) => {
              setScenarioPrice(e.target.value);
              setError("");
            }}
          />
        </label>
        <input
          className="price-slider"
          aria-label="Price comparison slider"
          aria-valuetext={money(Number(scenarioPrice || 0), true)}
          type="range"
          min="0"
          max={Math.round(price * 100)}
          step="1"
          value={Math.min(
            Math.round(price * 100),
            Math.max(0, Math.round(Number(scenarioPrice) * 100)),
          )}
          onChange={(e) => {
            setScenarioPrice((Number(e.target.value) / 100).toFixed(2));
            setError("");
          }}
        />
        <div className="slider-labels">
          <span>Skip · $0</span>
          <span>Original · {money(price, true)}</span>
        </div>
        <div className="scenario-results" aria-live="polite">
          <div>
            <small>Difference to set aside</small>
            <strong>
              {impact ? money(impact.difference, true) : "Calculating…"}
            </strong>
          </div>
          <div>
            <small>Added time to your goal</small>
            <strong>
              {impact
                ? impact.delay_days === null
                  ? "Set a monthly plan"
                  : `${impact.delay_days.toLocaleString()} ${impact.delay_days === 1 ? "day" : "days"}`
                : "Calculating…"}
            </strong>
          </div>
        </div>
        {impact?.days_kept !== null &&
          impact?.days_kept !== undefined &&
          impact.days_kept > 0 && (
            <p className="scenario-benefit">
              Your goal stays {impact.days_kept.toLocaleString()}{" "}
              {impact.days_kept === 1 ? "day" : "days"} closer than paying the
              original price.
            </p>
          )}
        <p className="fine-print">
          Assumes this spending comes out of your savings plan. Dates use your
          monthly contribution, without interest.
        </p>
        <button
          className="text-link"
          disabled={
            Number(scenarioPrice) <= 0 || Number(scenarioPrice) >= price
          }
          onClick={() => {
            setTarget(scenarioPrice);
            setSaved(false);
            const panel =
              document.querySelector<HTMLDetailsElement>(".pause-plan");
            if (panel) {
              panel.open = true;
              panel.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        >
          Use this as my target price <ArrowRight size={15} />
        </button>
      </section>
      <details className="card pause-plan">
        <summary>
          <Clock3 size={19} />
          Save a target and reminder
        </summary>
        <Clock3 className="section-icon" />
        <h2>Give the decision some time.</h2>
        <p>
          Save a target price and a reminder to revisit this check. Reminders
          appear in SpendShield when you open it; there are no email or push
          notifications.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post(`/purchases/${purchase.id}/plan`, {
                hours: Number(hours),
                target_price: target || null,
              });
              await onSaved();
              setSaved(true);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-row">
            <label>
              Target price (optional, USD)
              <input
                type="number"
                min="0.01"
                max={Math.max(0, price - 0.01)}
                step="0.01"
                value={target}
                placeholder="A price you'd be comfortable with"
                onChange={(e) => {
                  setTarget(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              Revisit in (hours)
              <input
                type="number"
                min="1"
                max="168"
                step="1"
                required
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <p className="fine-print">
            {purchase.ai.status === "live"
              ? purchase.cooldown_recommendation > 0
                ? `Gemini suggested ${purchase.cooldown_recommendation} ${purchase.cooldown_recommendation === 1 ? "hour" : "hours"}. Choose the pause that suits you.`
                : "Gemini did not suggest a pause. You can add one if it would help."
              : "A 48-hour pause is a starting point. Choose 1–168 hours."}
          </p>
          <button className="secondary full" disabled={busy}>
            {busy ? "Saving…" : "Save reminder"}
          </button>
          {saved && (
            <p className="inline-success" role="status">
              <Check size={16} />
              Saved. Find it under Saved purchase checks.
            </p>
          )}
        </form>
        {error && (
          <p role="alert" className="modal-error">
            {error}
          </p>
        )}
      </details>
      <details className="card search-options">
        <summary>
          <Search size={19} />
          Find alternatives on Google
        </summary>
        <h2>Explore alternatives</h2>
        <p>
          Open a web search, then enter an option and its actual price below.
          These are search suggestions, not verified offers.
        </p>
        {queries.map((q, i) => (
          <a
            key={i}
            href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Search Google for ${q} (opens a new tab)`}
          >
            <Search size={15} />
            <span>{q}</span>
            <ArrowRight size={15} />
          </a>
        ))}
      </details>
    </>
  );
}

export function CategoryReview({
  suggestions,
  onApplied,
}: {
  suggestions: Scan["suggestions"];
  onApplied: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  if (!suggestions?.length || dismissed) return null;
  return (
    <section className="card category-review">
      <div className="card-heading">
        <div>
          <span className="overline">YOU APPROVE THE CHANGES</span>
          <h2>
            Review {suggestions.length} suggested{" "}
            {suggestions.length === 1 ? "category" : "categories"}
          </h2>
          <p>Your records stay unchanged until you apply a selection.</p>
        </div>
        <Sparkles size={22} />
      </div>
      {suggestions.map((s) => (
        <label className="review-row" key={s.id}>
          <input
            type="checkbox"
            checked={selected.includes(s.id)}
            onChange={(e) =>
              setSelected((ids) =>
                e.target.checked
                  ? [...ids, s.id]
                  : ids.filter((id) => id !== s.id),
              )
            }
          />
          <span>
            <strong>{s.merchant}</strong>
            <small>
              {s.date} · {money(Math.abs(s.amount_cents) / 100, true)}
              {s.normalized_merchant !== s.merchant
                ? ` · Recognized as ${s.normalized_merchant}`
                : ""}
            </small>
          </span>
          <span>
            Other <ArrowRight size={13} /> {s.category}
            <small>{Math.round(s.confidence * 100)}% model confidence</small>
          </span>
        </label>
      ))}
      <div className="review-actions">
        <button
          className="primary"
          disabled={busy || !selected.length}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await post("/transactions/review-categories", {
                items: suggestions
                  .filter((s) => selected.includes(s.id))
                  .map(({ id, merchant, category }) => ({
                    id,
                    merchant,
                    category,
                  })),
              });
              await onApplied();
              setDismissed(true);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Applying…" : `Apply ${selected.length} selected`}
        </button>
        <button
          className="text-link"
          disabled={busy}
          onClick={() => setDismissed(true)}
        >
          Keep current categories
        </button>
      </div>
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function RestoreBackup({
  onRestored,
}: {
  onRestored: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    transactions: number;
    decisions: number;
    goal: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [undo, setUndo] = useState(false);
  useEffect(() => {
    api<{ available: boolean }>("/profile/recovery")
      .then((r) => setRecovery(r.available))
      .catch((e) => setError(errorText(e)));
  }, []);
  return (
    <>
      <FileJson className="section-icon" />
      <h2>Restore a backup</h2>
      <p>
        Use the JSON file downloaded from Settings. Preview it first, then
        choose whether to replace this profile. We keep one recovery snapshot so
        you can undo the restore.
      </p>
      <label className="upload-zone">
        <FileJson />
        <strong>{file?.name || "Choose a SpendShield backup"}</strong>
        <span>JSON · up to 10 MB</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            setPreview(null);
            setConfirmed(false);
            setError("");
            setBusy(true);
            try {
              const form = new FormData();
              form.append("file", f);
              setPreview(
                await api("/profile/restore-preview", {
                  method: "POST",
                  body: form,
                }),
              );
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && !preview && <p role="status">Checking backup…</p>}
      {preview && (
        <div className="restore-preview">
          <h3>{preview.name}'s profile</h3>
          <p>
            {preview.transactions} transactions · {preview.decisions} decision
            records
            <br />
            Goal: {preview.goal}
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Replace my current profile with this backup. Gemini will be turned
              off until I enable it again.
            </span>
          </label>
          <button
            className="primary full"
            disabled={busy || !confirmed}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const form = new FormData();
                form.append("file", file);
                await api("/profile/restore?confirm=true", {
                  method: "POST",
                  body: form,
                });
                await onRestored();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Restoring…" : "Restore this backup"}
          </button>
        </div>
      )}
      {recovery && (
        <div className="recovery-panel">
          <h3>Undo the last restore</h3>
          <p>
            This returns to the profile saved immediately before your last
            restore. Any changes since that restore will be replaced.
          </p>
          {undo ? (
            <div className="compact-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await post("/profile/undo-restore");
                    await onRestored();
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm undo restore
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => setUndo(false)}
              >
                Keep current data
              </button>
            </div>
          ) : (
            <button className="text-link" onClick={() => setUndo(true)}>
              <RotateCcw size={15} />
              Undo last restore
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="modal-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

const guide = [
  [
    "Start with your own numbers",
    "Set your preferred name, monthly spending budget and one savings goal. Your budget covers shopping, eating out, entertainment, gambling and uncategorized expenses. It is a limit, not your bank balance. Settings lets you change these later.",
  ],
  [
    "Build an accurate Overview",
    "Choose Add transaction for money already spent or received. Enter a positive amount and pick Income for money in. Other categories record money out. Import CSV previews your statement before adding it and skips exact duplicates. Edit or remove entries in Activity.",
  ],
  [
    "Check a purchase before spending",
    "Open Purchase Shield. Enter a product, price and category, or enable Gemini in Settings and upload an image. Select Show me the tradeoff. Check any extracted price before deciding. Correct a price with Edit price.",
  ],
  [
    "Compare prices and save a reminder",
    "Use What if you spent less? to see how a different price changes the goal delay. Set a target price and a 1–168 hour reminder. Reminders appear inside the app when due. Saved checks can be searched, paged, archived and restored. They do not monitor retailer prices.",
  ],
  [
    "Explore and choose an alternative",
    "Explore alternatives opens web searches in a new tab. Verify the price yourself, then enter the alternative name and price. Choosing it records the price difference as planned savings; it does not purchase the item or record an expense.",
  ],
  [
    "Plan savings, then confirm them",
    "Skip a purchase or choose a cheaper option to add planned savings. Move the money yourself. In Activity, select Mark as saved to add it to confirmed goal progress. Already saved is your starting balance; recorded Savings transactions are separate transfers and do not also increase the goal.",
  ],
  [
    "Correct a decision",
    "Activity provides Mark as not saved to move money back to the plan. Undo decision removes it from Money Rescued and confirmed savings, if applicable, and reopens its purchase check. It does not move money or change a bank balance.",
  ],
  [
    "Scan and review your spending",
    "Financial Scan looks for spending patterns. Gemini can propose categories for Other transactions. Select the suggestions you agree with and apply them; nothing is recategorized automatically. Insights use the records available when you run the scan.",
  ],
  [
    "Track subscription cancellations",
    "Recurring subscriptions need one similar charge per month, 20–40 days apart, within the last 90 days. Cancel directly with the provider first, then select I’ve cancelled this. One month of the charge enters your savings plan; the annual figure is an estimate of that charge times 12. Undo it in Activity if you restart the subscription.",
  ],
  [
    "Use Gambling Guard voluntarily",
    "Choose a weekly limit and enable the guard. Enter an amount and select See the impact to preview it. Start a 24-hour pause or plan to save that amount instead. Review recorded gambling transactions below. The guard cannot block payments or betting accounts. Support resources are available whether it is enabled or not.",
  ],
  [
    "Back up, restore and manage privacy",
    "Settings downloads your profile as JSON and offers Restore a backup with a preview and confirmation. Undo last restore recovers the previous profile once. Gemini is opt-in and sends relevant context/images to Google only for requested AI features. The API key stays on the server.",
  ],
  [
    "Understand the limits",
    "This is a local, single-person USD app with one active savings goal. There is no bank sync, online sign-in, payment transfer or automatic subscription cancellation. CSV refunds are not supported. Goal dates are illustrative 30-day-month projections, not guarantees; totals are only as complete as your entries.",
  ],
];
export function ProductGuide() {
  return (
    <>
      <span className="overline">A PURCHASE PAUSE WITH A PURPOSE</span>
      <h2>Your guide to SpendShield</h2>
      <p>
        Record your spending → check the next purchase → plan the difference →
        confirm what you saved.
      </p>
      <div className="guide-list">
        {guide.map(([title, body], i) => (
          <details key={title} open={i === 0}>
            <summary>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {title}
            </summary>
            <p>{body}</p>
          </details>
        ))}
      </div>
    </>
  );
}
