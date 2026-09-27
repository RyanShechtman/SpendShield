import { useEffect, useState } from "react";
import { Award, CalendarDays, Wallet } from "lucide-react";
import { themeReward } from "./Appearance";
import { LiveSettings } from "./LiveSettings";
import { api, post, money } from "./api";

type Badge = {
  id: string;
  name: string;
  group: string;
  requirement: string;
  earned: string | null;
  progress: number;
  target: number;
  kind?: string;
  days?: number;
};
type Plan = {
  collection: Badge[];
  tracks: { id: string; name: string; description: string; step: string }[];
  today: string;
  pay: null | {
    frequency: string;
    net_pay_cents: number;
    essentials_cents: number;
    monthly_income: number;
    monthly_savings: number;
    suggested_budget: number;
    shortfall: number;
    current_budget: number;
  };
  challenge: null | {
    title: string;
    kind?: string;
    days: number;
    start: string;
    completed: boolean;
  };
  progress: number;
  checked_today: boolean;
  badges: { days: number; name: string; earned: string }[];
  total_checkins: number;
};
export function MyPlan({ onChanged }: { onChanged: () => Promise<void> }) {
  const [view, setView] = useState("plan");
  const [kind, setKind] = useState("review");
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState<Plan | null>(null);
  const [frequency, setFrequency] = useState("monthly");
  const [pay, setPay] = useState("");
  const [essentials, setEssentials] = useState("");
  const [title, setTitle] = useState("Pause and review my spending");
  const [days, setDays] = useState(7);
  const [reviewed, setReviewed] = useState(false);
  const [step, setStep] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    api<Plan>("/planning")
      .then((p) => {
        if (!alive) return;
        setData(p);
        if (p.pay) {
          setFrequency(p.pay.frequency);
          setPay(String(p.pay.net_pay_cents / 100));
          setEssentials(String(p.pay.essentials_cents / 100));
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function action(path: string, body: unknown, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(await post<Plan>("/planning" + path, body));
      setNotice(message);
      setReviewed(false);
      setStep(false);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p role="status">{error || "Opening your plan…"}</p>;
  const active = data.challenge;
  const started = active && data.today >= active.start;
  const milestones = data.collection.filter((b) => b.kind === kind);
  const earnedCount = data.collection.filter((b) => b.earned).length;
  const selectedTrack = data.tracks.find((t) => t.id === kind)!;
  const activeTrack = data.tracks.find(
    (t) => t.id === (active?.kind || "review"),
  )!;
  return (
    <div className="plan-stack">
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="budget-warning">
          {notice}
        </p>
      )}
      <nav className="plan-switch" aria-label="My Plan sections">
        <button
          className={view === "plan" ? "primary" : "secondary"}
          aria-pressed={view === "plan"}
          onClick={() => setView("plan")}
        >
          Pay &amp; challenges
        </button>
        <button
          className={view === "achievements" ? "primary" : "secondary"}
          aria-pressed={view === "achievements"}
          onClick={() => setView("achievements")}
        >
          Achievements · {earnedCount}
        </button>
      </nav>
      <div className="plan-stack" hidden={view !== "plan"}>
        <section className="card">
          <Wallet className="section-icon" />
          <h2>Your pay, in perspective</h2>
          <p>
            Plan with take-home pay after tax. Expected pay stays separate from
            Income transactions, so your salary is never counted twice.
          </p>
          <form
            className="plan-fields"
            onSubmit={(e) => {
              e.preventDefault();
              void action(
                "/pay",
                { frequency, net_pay: pay, essentials },
                "Pay plan saved. Your spending budget has not changed.",
              );
            }}
          >
            <label>
              Pay frequency
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="weekly">Weekly — 52 payments a year</option>
                <option value="biweekly">
                  Every two weeks — 26 payments a year
                </option>
                <option value="semimonthly">
                  Twice a month — 24 payments a year
                </option>
                <option value="monthly">Monthly — 12 payments a year</option>
              </select>
            </label>
            <label>
              Take-home pay per payment (USD)
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                required
                value={pay}
                onChange={(e) => setPay(e.target.value)}
              />
            </label>
            <label>
              Monthly essentials and bills (USD)
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                required
                value={essentials}
                onChange={(e) => setEssentials(e.target.value)}
              />
            </label>
            <p className="fine-print">
              Include rent, groceries, transport, subscriptions, debt payments
              and other required costs. Keep discretionary spending and your
              savings contribution out of this figure.
            </p>
            <button className="primary" disabled={busy}>
              Save pay plan
            </button>
          </form>
          {data.pay && (
            <div className="plan-summary">
              <p>
                Average monthly take-home pay{" "}
                <strong>{money(data.pay.monthly_income, true)}</strong>
              </p>
              <p>
                Monthly savings contribution{" "}
                <strong>{money(data.pay.monthly_savings, true)}</strong> (edit
                in your goal settings)
              </p>
              <p>
                Amount left for discretionary spending{" "}
                <strong>{money(data.pay.suggested_budget, true)}</strong>
              </p>
              {data.pay.shortfall > 0 && (
                <p role="status">
                  Your bills and savings plan exceed expected pay by{" "}
                  {money(data.pay.shortfall, true)} a month. Review those
                  amounts before committing to the plan.
                </p>
              )}
              <p className="fine-print">
                This is an annualized average, not money currently available in
                your bank. Weekly and two-weekly pay can vary by calendar month.
                Record each actual paycheck as Income.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(
                    "/apply-budget",
                    {},
                    "Your monthly spending budget now uses the saved pay plan.",
                  )
                }
              >
                Use {money(data.pay.suggested_budget, true)} as my monthly
                budget
              </button>
            </div>
          )}
        </section>
        <section className="card" id="habit-challenges">
          <CalendarDays className="section-icon" />
          <h2>Small steps, lasting habits</h2>
          <p>
            Choose an app-suggested review challenge or give it your own name.
            Each check-in means reviewing your spending and choosing a helpful
            next step. No purchases, deposits or gambling are required.
          </p>
          {(!active || active.completed) && data.badges.length < 9 && (
            <form
              className="plan-fields"
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  "/challenge",
                  { title, days, kind },
                  "Challenge started. Check in on separate days; missed days never erase progress.",
                );
              }}
            >
              <label>
                Challenge focus
                <select
                  value={kind}
                  onChange={(e) => {
                    const k = e.target.value;
                    setKind(k);
                    setTitle(data.tracks.find((t) => t.id === k)!.name);
                    setDays(
                      data.collection.find((b) => b.kind === k && !b.earned)
                        ?.days || 7,
                    );
                  }}
                >
                  {data.tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {selectedTrack.description} You can personalize the name; the
                completion requirements stay the same.
              </p>
              <label>
                Your challenge name
                <input
                  value={title}
                  maxLength={80}
                  required
                  pattern=".*\S.*"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Check-in goal
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  {milestones.map((m) => (
                    <option key={m.days} value={m.days} disabled={!!m.earned}>
                      {m.days} daily reviews — {m.name}
                      {m.earned ? " (earned)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={
                  busy || milestones.some((b) => b.days === days && !!b.earned)
                }
              >
                Start my challenge
              </button>
            </form>
          )}
          {active && (
            <div className="plan-summary">
              <h3>{active.title}</h3>
              <p>
                {Math.min(data.progress, active.days)} of {active.days} daily
                reviews completed
              </p>
              <progress
                aria-label="Challenge progress"
                max={active.days}
                value={Math.min(data.progress, active.days)}
              />
              {active.completed ? (
                <p role="status">
                  Milestone earned. You made time to review your choices. There
                  is no deadline to start another challenge.
                </p>
              ) : (
                <>
                  {!started ? (
                    <p>
                      Your next challenge begins {active.start}. Today’s
                      check-in already counted toward another challenge.
                    </p>
                  ) : data.checked_today ? (
                    <p>
                      You’ve checked in today. Come back another day when it
                      works for you.
                    </p>
                  ) : (
                    <div className="plan-fields">
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={reviewed}
                          onChange={(e) => setReviewed(e.target.checked)}
                        />
                        <span>
                          I reviewed today’s spending and recorded anything
                          missing, including a day with no spending.
                        </span>
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={step}
                          onChange={(e) => setStep(e.target.checked)}
                        />
                        <span>{activeTrack.step}</span>
                      </label>
                      <button
                        className="primary"
                        disabled={busy || !reviewed || !step}
                        onClick={() =>
                          void action(
                            "/check-in",
                            {},
                            "Today's review is recorded. One step at a time.",
                          )
                        }
                      >
                        Record today’s review
                      </button>
                    </div>
                  )}
                  <details>
                    <summary>End this challenge</summary>
                    <p>
                      This ends the current challenge without awarding its
                      badge. Earned badges remain. You can start again whenever
                      you choose.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(
                          "/end-challenge",
                          {},
                          "Challenge ended. Your earned badges remain.",
                        )
                      }
                    >
                      End challenge without a badge
                    </button>
                  </details>
                </>
              )}
            </div>
          )}
          <button className="secondary" onClick={() => setView("achievements")}>
            Explore your achievements · {earnedCount} earned
          </button>
          <p className="fine-print">
            Check-ins are self-reported, not proof of savings or recovery. Only
            one per date counts, each badge can be earned once, and previous
            check-ins cannot be reused for another challenge. They also count
            toward lifetime review milestones. Missing a day has no penalty.
            Badges have no cash value, rankings or random rewards.
          </p>
          <p>
            For gambling-related concerns, practical support is available
            alongside your plan.{" "}
            <a
              href="https://www.ncpgambling.org/help-treatment/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Find confidential support (opens a new tab)
            </a>
            . Badges are not treatment.
          </p>
        </section>
      </div>
      {view === "plan" && <LiveSettings />}
      {view === "achievements" && (
        <section className="card achievement-section">
          <Award className="section-icon" />
          <h2>Your achievements</h2>
          <p>
            Small reminders of the time you’ve put into your plan. Pick a
            meaningful next step, or leave the collection for later.
          </p>
          <p>
            <strong>
              {earnedCount} of {data.collection.length} earned
            </strong>{" "}
            · {data.total_checkins} daily reviews recorded
          </p>
          <label className="collection-filter">
            Show badges{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All badges</option>
              <option value="earned">Earned</option>
              <option value="available">Not yet earned</option>
            </select>
          </label>
          {filter === "earned" && earnedCount === 0 && (
            <p>
              No badges yet. Save a pay plan or try a review challenge when
              you’re ready.
            </p>
          )}
          <div className="milestone-grid">
            {data.collection
              .filter(
                (b) =>
                  filter === "all" ||
                  (filter === "earned" ? !!b.earned : !b.earned),
              )
              .map((b) => (
                <article
                  className={"milestone " + (b.earned ? "earned" : "")}
                  key={b.id}
                >
                  <div
                    className={
                      "badge-medallion badge-tone-" +
                      (data.collection.indexOf(b) % 3)
                    }
                  >
                    <Award aria-hidden="true" size={32} />
                  </div>
                  <span className="fine-print">{b.group}</span>
                  <h3>{b.name}</h3>
                  <p>{b.requirement}</p>
                  {themeReward(b.id) && (
                    <small className="theme-reward-note">
                      Also unlocks the {themeReward(b.id)} theme in Settings.
                    </small>
                  )}
                  {b.earned ? (
                    <strong>Earned {b.earned}</strong>
                  ) : (
                    <>
                      <span>
                        {b.progress} of {b.target}{" "}
                        {b.kind || b.id.startsWith("total-")
                          ? b.target === 1
                            ? "review"
                            : "reviews"
                          : "step"}
                      </span>
                      <progress
                        aria-label={b.name + " progress"}
                        max={b.target}
                        value={b.progress}
                      />
                      {b.kind ? (
                        <button
                          className="secondary"
                          disabled={!!active && !active.completed}
                          onClick={() => {
                            requestAnimationFrame(() =>
                              document
                                .getElementById("habit-challenges")
                                ?.scrollIntoView({ block: "start" }),
                            );
                            setKind(b.kind!);
                            setDays(b.days!);
                            setTitle(
                              data.tracks.find((t) => t.id === b.kind)!.name,
                            );
                            setView("plan");
                          }}
                        >
                          Choose this challenge
                        </button>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() => {
                            setView("plan");
                            if (b.id.startsWith("live-"))
                              requestAnimationFrame(() =>
                                document
                                  .getElementById("live-settings")
                                  ?.scrollIntoView(),
                              );
                          }}
                        >
                          {b.id.startsWith("live-")
                            ? "Set up SpendShield Live"
                            : b.id.startsWith("total-")
                              ? "Go to daily reviews"
                              : "Go to pay plan"}
                        </button>
                      )}
                    </>
                  )}
                </article>
              ))}
          </div>
          {active && !active.completed && (
            <p>
              Finish or end your active challenge in Pay &amp; challenges before
              choosing another.
            </p>
          )}
          <p className="fine-print">
            Badges are earned once and stay as a record of past actions. Review
            badges use your check-ins, not bank verification. No spending,
            gambling, perfect streak or cash reward is involved. Financial JSON
            backups do not transfer badges; keep your app’s data folder to
            preserve this collection.
          </p>
        </section>
      )}
    </div>
  );
}
