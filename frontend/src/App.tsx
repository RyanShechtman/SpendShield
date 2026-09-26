import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  HeartHandshake,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Settings,
  ScanLine,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { api, money, post } from "./api";
import {
  SavedChecks,
  PurchaseTools,
  CategoryReview,
  RestoreBackup,
  ProductGuide,
} from "./Workflows";
import {
  Onboarding,
  ProfileSettings,
  TransactionEditor,
  ImportTransactions,
} from "./PersonalControls";
import type {
  AI,
  Dashboard,
  Guard,
  Purchase,
  Scan,
  Transaction,
} from "./types";

type Page =
  | "Overview"
  | "Purchase Shield"
  | "Financial Scan"
  | "Gambling Guard"
  | "Activity";
type Modal =
  | "settings"
  | "transaction"
  | "confirm-saved"
  | "undo-decision"
  | "unconfirm"
  | "restore"
  | "help"
  | "import"
  | "goal"
  | "budget"
  | null;
const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Purchase Shield", icon: ShieldCheck },
  { name: "Financial Scan", icon: ScanLine },
  { name: "Gambling Guard", icon: HeartHandshake },
  { name: "Activity", icon: Clock3 },
] as const;
const colors = [
  "#194d40",
  "#9cc391",
  "#cabbe2",
  "#dcbda0",
  "#8aa9bc",
  "#b8c594",
  "#da9d95",
  "#a2bdb3",
];
const dayText = (days: number | null) =>
  days === null
    ? "Set a savings plan"
    : `${days.toLocaleString()} ${days === 1 ? "day" : "days"}`;
const dateText = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not projected";

function AIStamp({ ai }: { ai: AI }) {
  return (
    <div className={"ai-stamp " + (ai.status === "live" ? "live" : "")}>
      <Sparkles size={14} />
      {ai.model
        ? `Powered by ${ai.model.replaceAll("-", " ")}`
        : "Calculated from your entries"}
      <span>{ai.status === "live" ? "Live" : "No AI used"}</span>
    </div>
  );
}
function Why({ children }: { children: ReactNode }) {
  return (
    <details className="why">
      <summary>
        <CircleHelp size={14} />
        Why am I seeing this?
      </summary>
      <div>{children}</div>
    </details>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={Math.max(0, Math.min(100, Math.round(value)))}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Goal progress"
    >
      <div style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </div>
  );
}
function Loading({
  label = "Loading your financial picture…",
}: {
  label?: string;
}) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" />
      {label}
    </div>
  );
}

export default function App() {
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState<Page>("Overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [aiStatus, setAiStatus] = useState("Checking Gemini…");
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pending, setPending] = useState<Purchase[]>([]);
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Shopping");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [proposed, setProposed] = useState("40");
  const [limit, setLimit] = useState("100");
  const [filter, setFilter] = useState("");
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [confirmEvent, setConfirmEvent] = useState<string | null>(null);
  const actionLock = useRef(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    const [d, g, t, p] = await Promise.all([
      api<Dashboard>("/dashboard"),
      api<Guard>("/gambling/status?proposed=40"),
      api<{ transactions: Transaction[] }>("/transactions"),
      api<Purchase[]>("/purchases/pending"),
    ]);
    setData(d);
    setGuard(g);
    setLimit(String(g.limit));
    setTransactions(t.transactions);
    setPending(p);
    setRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!data?.profile.ai_enabled) {
      setAiStatus("AI is off");
      return;
    }
    void api<{ status: string; configured: boolean }>("/gemini/status")
      .then((s) =>
        setAiStatus(
          s.status === "ready"
            ? "Gemini connected"
            : s.configured
              ? "Gemini unavailable"
              : "Gemini not configured",
        ),
      )
      .catch(() => setAiStatus("Gemini unavailable"));
  }, [data?.profile.ai_enabled]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  useEffect(() => {
    if (modal) {
      setError("");
      modalRef.current?.showModal();
    } else modalRef.current?.close();
  }, [modal]);
  useEffect(() => {
    if (purchase?.id && page === "Purchase Shield")
      requestAnimationFrame(() =>
        document
          .querySelector(".purchase-result-column")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }, [purchase?.id, page]);
  async function run(label: string, action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy("");
      actionLock.current = false;
    }
  }
  function navigate(next: Page) {
    setPage(next);
    setError("");
    setCelebrate(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function analyze(e: FormEvent) {
    e.preventDefault();
    await run("analysis", async () => {
      let result: Purchase;
      if (imageFile) {
        const form = new FormData();
        form.append("file", imageFile);
        result = await api<Purchase>("/ai/analyze-purchase-image", {
          method: "POST",
          body: form,
        });
      } else
        result = await post<Purchase>("/ai/analyze-purchase", {
          text,
          price: price || null,
          category,
          use_ai: data?.profile.ai_enabled ?? false,
        });
      setCelebrate(null);
      setRevision((v) => v + 1);
      setPurchase(result);
      setPrice(
        result.detected_price === null ? "" : String(result.detected_price),
      );
      if (result.ai.model) setAiStatus("Gemini connected");
      setPending(await api<Purchase[]>("/purchases/pending"));
      setRevision((v) => v + 1);
    });
  }
  async function protect(
    action: string,
    alternative_id?: string,
    alternative?: { alternative_name: string; alternative_price: string },
  ) {
    if (!purchase) return;
    await run("protect", async () => {
      const result = await post<{ protected: number; dashboard: Dashboard }>(
        "/purchases/protect",
        { purchase_id: purchase.id, action, alternative_id, ...alternative },
      );
      setData(result.dashboard);
      setPurchase({ ...purchase, resolved: true });
      setCelebrate(result.protected);
      setToast(
        `Protected ${money(result.protected)}. Recorded in your savings plan. Mark it as saved after you set it aside.`,
      );
      setPending(await api<Purchase[]>("/purchases/pending"));
      setRevision((v) => v + 1);
    });
  }
  async function financialScan() {
    await run("scan", async () => {
      const result = await post<Scan>("/ai/financial-scan");
      setScan(result);
      setData(result.dashboard);
      if (result.ai.model) setAiStatus("Gemini connected");
      const t = await api<{ transactions: Transaction[] }>("/transactions");
      setTransactions(t.transactions);
    });
  }

  if (!data)
    return (
      <div className="startup">
        <div className="brand">
          <ShieldCheck />
          SpendShield
        </div>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="primary"
              onClick={() => void run("retry", refresh)}
            >
              Try again
            </button>
          </>
        ) : (
          <Loading />
        )}
      </div>
    );
  if (!data.profile.onboarded && !data.profile.demo)
    return <Onboarding onComplete={refresh} />;
  function addTransaction() {
    setEditingTransaction(null);
    setModal("transaction");
  }
  async function changedData(message: string) {
    await refresh();
    setPurchase(null);
    setScan(null);
    setModal(null);
    setToast(message);
  }
  const goal = data.goal;
  const guarded = guard?.enabled;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          SpendShield<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR FINANCIAL SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-label={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "nav-item active" : "nav-item"}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Purchase Shield" && (
                <span className="nav-new">AI</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={24} />
            <h3>
              A little pause.
              <br />A bigger future.
            </h3>
            <p>Give your next decision a second thought.</p>
            <button onClick={() => navigate("Purchase Shield")}>
              Check a purchase <ArrowRight size={15} />
            </button>
          </div>
          <button
            className="profile profile-button"
            onClick={() => setModal("settings")}
            aria-label="Edit profile"
          >
            <div className="avatar">
              {data.profile.name
                .split(/\s+/)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <strong>{data.profile.name}</strong>
              <small>Edit profile & settings</small>
            </div>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <button
              className="guide-button"
              aria-label="How to use SpendShield"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={17} />
              <span>Guide</span>
            </button>
            <span className="privacy">
              <LockKeyhole size={13} />
              Local storage
            </span>
            <button
              className="icon-button"
              aria-label="Settings"
              title="Settings"
              onClick={() => setModal("settings")}
            >
              <Settings size={19} />
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div className="error-banner" role="alert">
              <span>
                {error}
                {imageFile && page === "Purchase Shield"
                  ? " You can enter the product and price manually below."
                  : ""}
              </span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={18} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overview"
                  ? "A LITTLE MORE INTENTION. A LOT MORE POSSIBILITY."
                  : page === "Purchase Shield"
                    ? "YOUR NEXT PURCHASE, IN PERSPECTIVE"
                    : page === "Financial Scan"
                      ? "NOTICE THE PATTERNS. FIND THE POSSIBILITIES."
                      : page === "Gambling Guard"
                        ? "YOUR LIMITS. YOUR CHOICE."
                        : "SMALL DECISIONS. VISIBLE PROGRESS."}
              </div>
              <h1>
                {page === "Overview"
                  ? `Looking ahead, ${data.profile.first_name}.`
                  : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "Know where you stand. Decide what comes next."
                  : page === "Purchase Shield"
                    ? "Is it worth it? See the tradeoff before you decide."
                    : page === "Financial Scan"
                      ? "Turn your transaction history into a clearer next step."
                      : page === "Gambling Guard"
                        ? "A voluntary pause, built around the boundaries you choose."
                        : "A record of what you spent and what you chose to protect."}
              </p>
            </div>
            {page === "Overview" ? (
              <button
                className="primary"
                onClick={() => navigate("Purchase Shield")}
              >
                <Plus size={17} />
                Check a purchase
              </button>
            ) : page === "Financial Scan" ? (
              <button
                className="primary"
                disabled={!!busy || !data.transaction_count}
                onClick={() => void financialScan()}
              >
                {busy === "scan" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}
                Run financial scan
              </button>
            ) : (
              <span className="date-label">{dateText(data.profile.as_of)}</span>
            )}
          </div>

          {page === "Overview" && (
            <>
              {pending.some(
                (p) => p.wait_until && Date.parse(p.wait_until) <= now,
              ) && (
                <section className="reminder-banner">
                  <Clock3 size={22} />
                  <div>
                    <strong>A purchase is ready to revisit.</strong>
                    <p>
                      Your pause has ended. Review it with a fresh perspective.
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => navigate("Purchase Shield")}
                  >
                    Review saved checks <ArrowRight size={15} />
                  </button>
                </section>
              )}
              <section className="next-step">
                <div>
                  <span className="overline">
                    {transactions.length
                      ? "KEEP YOUR PICTURE UP TO DATE"
                      : "YOUR NEXT STEP"}
                  </span>
                  <h2>
                    {transactions.length
                      ? "Record your spending as you go."
                      : "Add your first transaction."}
                  </h2>
                  <p>
                    {transactions.length
                      ? `Last transaction: ${dateText(data.latest_transaction)}. Budget totals include only the spending you record.`
                      : "Start with an income or expense, or import your statement. Until then, your dashboard is a plan—not a complete picture of your finances."}
                  </p>
                </div>
                <div>
                  <button className="primary" onClick={addTransaction}>
                    <Plus size={16} />
                    Add transaction
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setModal("import")}
                  >
                    <Upload size={16} />
                    Import CSV
                  </button>
                </div>
              </section>

              {data.over_budget > 0 && (
                <p className="budget-warning" role="status">
                  You’re {money(data.over_budget, true)} over your monthly
                  spending budget.{" "}
                  <button
                    className="text-link"
                    onClick={() => navigate("Activity")}
                  >
                    Review transactions
                  </button>
                </p>
              )}
              <div className="metric-grid">
                <Metric
                  label="Monthly income"
                  value={money(data.income)}
                  icon={<ArrowDownLeft size={18} />}
                  note="Income recorded this month"
                />
                <Metric
                  label="Monthly expenses"
                  value={money(data.expenses)}
                  icon={<ArrowUpRight size={18} />}
                  note="Excludes savings transfers"
                />
                <Metric
                  label="Spending budget left"
                  value={money(data.available)}
                  icon={<Wallet size={18} />}
                  note={
                    <button
                      className="text-link"
                      onClick={() => setModal("budget")}
                    >
                      Of your {money(data.budget)} discretionary budget
                    </button>
                  }
                />
                <Metric
                  label="Savings rate"
                  value={
                    data.savings_rate === null ? "—" : `${data.savings_rate}%`
                  }
                  icon={<TrendingUp size={18} />}
                  note={`${money(data.savings_transfers)} in recorded savings transfers`}
                />
              </div>
              <div className="overview-feature">
                <section className="goal-card">
                  <div className="card-heading">
                    <span className="overline">
                      <Target size={17} />
                      THE GOAL YOU’RE BUILDING
                    </span>
                    <button
                      className="light-link"
                      onClick={() => setModal("goal")}
                    >
                      Edit goal <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="goal-content">
                    <div>
                      <h2>{goal.name}</h2>
                      <p>Money you have confirmed as saved.</p>
                      <div className="goal-amount">
                        {money(goal.saved)}
                        <span> / {money(goal.target)}</span>
                      </div>
                    </div>
                    <div className="goal-emblem">
                      <ShieldCheck size={51} strokeWidth={1.25} />
                    </div>
                  </div>
                  <Progress value={goal.progress} />
                  <div className="goal-foot">
                    <span>{goal.progress}% of the way there</span>
                    <span>
                      <span className="tiny-dot" />
                      {goal.date
                        ? `On plan for ${dateText(goal.date)}`
                        : goal.monthly
                          ? "Completion date too far to estimate"
                          : "Add a monthly savings plan"}
                    </span>
                  </div>
                  {goal.planned > 0 && (
                    <button
                      className="planned-goal"
                      onClick={() => navigate("Activity")}
                    >
                      {money(goal.planned)} planned · confirm when saved{" "}
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <div className="goal-context">
                    <Clock3 size={16} />
                    <span>
                      {dayText(goal.days)} to your goal at {money(goal.monthly)}
                      /month
                    </span>
                    <span className="virtual-pill">Confirmed savings</span>
                  </div>
                </section>
                <section className="rescue-card">
                  <div className="rescue-label">
                    <span className="rescue-icon">
                      <Leaf size={21} />
                    </span>
                    MONEY RESCUED <span className="period">THIS MONTH</span>
                  </div>
                  <div
                    className="rescued-amount"
                    key={data.money_rescued.this_month}
                  >
                    {money(data.money_rescued.this_month)}
                  </div>
                  <h3>Decisions worth keeping.</h3>
                  <p>
                    Money you chose not to spend.
                    <br />
                    Confirm it as saved once set aside.
                  </p>
                  <div className="rescue-bottom">
                    <span>
                      <CheckCheck size={17} />
                      {data.money_rescued.events.length} intentional{" "}
                      {data.money_rescued.events.length === 1
                        ? "decision"
                        : "decisions"}
                    </span>
                    <button
                      aria-label="View protected money activity"
                      onClick={() => navigate("Activity")}
                    >
                      <ArrowUpRight size={22} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="dashboard-grid">
                <section className="card spending-card">
                  <div className="card-heading">
                    <div>
                      <h2>Where your money goes</h2>
                      <p>Expenses this month</p>
                    </div>
                    <span className="subtle-pill">
                      {new Date(
                        data.profile.as_of + "T12:00:00",
                      ).toLocaleDateString("en-US", { month: "long" })}
                    </span>
                  </div>
                  {!data.categories.length && (
                    <p className="empty-note">
                      Add an expense this month to see your category breakdown.
                    </p>
                  )}
                  <div className="spending-total">
                    {money(data.expenses)}
                    <span>total spent</span>
                  </div>
                  <div
                    className="stacked-bar"
                    aria-label="Spending by category"
                  >
                    {data.categories.map((c, i) => (
                      <div
                        key={c.name}
                        title={`${c.name}: ${money(c.value)}`}
                        style={{
                          width:
                            (data.expenses
                              ? (c.value / data.expenses) * 100
                              : 0) + "%",
                          background: colors[i % colors.length],
                        }}
                      />
                    ))}
                  </div>
                  <div className="category-list">
                    {data.categories.slice(0, 6).map((c, i) => (
                      <div key={c.name}>
                        <span>
                          <i
                            style={{ background: colors[i % colors.length] }}
                          />
                          {c.name}
                        </span>
                        <strong>{money(c.value)}</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="card-link"
                    onClick={() => navigate("Activity")}
                  >
                    Explore transactions <ArrowRight size={15} />
                  </button>
                </section>
                <section className="card trend-card">
                  <div className="card-heading">
                    <div>
                      <h2>The bigger picture</h2>
                      <p>Weekly discretionary spending</p>
                    </div>
                    <TrendingUp size={20} className="muted" />
                  </div>
                  {!data.trend.some((t) => t.amount > 0) ? (
                    <p className="empty-note">
                      Add discretionary expenses to see your spending trend over
                      the last eight weeks.
                    </p>
                  ) : (
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={data.trend}
                          margin={{ left: 6, right: 12, top: 20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="spendingFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#89af88"
                                stopOpacity={0.38}
                              />
                              <stop
                                offset="100%"
                                stopColor="#89af88"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="week"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#7c8984" }}
                            interval={1}
                          />
                          <YAxis
                            width={55}
                            tickFormatter={(v) => money(Number(v))}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#63745d" }}
                          />
                          <Tooltip
                            formatter={(v) => money(Number(v))}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid #dce4df",
                            }}
                          />
                          <Area
                            isAnimationActive={false}
                            type="monotone"
                            dataKey="amount"
                            stroke="#507b5a"
                            fill="url(#spendingFill)"
                            strokeWidth={2.5}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="insight-snippet">
                    <span className="soft-icon">
                      <Sparkles size={19} />
                    </span>
                    <div>
                      <strong>Your next opportunity is in the details.</strong>
                      <p>Review recurring charges and spending patterns.</p>
                    </div>
                  </div>
                  <button
                    className="card-link"
                    onClick={() => navigate("Financial Scan")}
                  >
                    Find opportunities <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <section className="bottom-prompt">
                <div className="soft-icon">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3>Before “add to cart,” add a little perspective.</h3>
                  <p>
                    A quick check today could bring your goal closer tomorrow.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => navigate("Purchase Shield")}
                >
                  Try Purchase Shield <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}

          {page === "Purchase Shield" && (
            <div className="purchase-layout">
              <div className="purchase-input-column">
                <section className="card purchase-form">
                  <div className="section-icon">
                    <ShoppingBag size={21} />
                  </div>
                  <h2>What’s on your mind?</h2>
                  <p>
                    A product, a dinner out, or an upgrade.
                    <br />
                    Bring the purchase here first.
                  </p>
                  <form onSubmit={(e) => void analyze(e)}>
                    <label htmlFor="product">Purchase you’re considering</label>
                    <textarea
                      id="product"
                      disabled={!!imageFile}
                      placeholder="e.g. Aero Run everyday running shoes"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      required={!imageFile}
                      maxLength={2000}
                    />
                    <div className="form-row">
                      <div>
                        <label htmlFor="price">Price (USD)</label>
                        <div className="currency-field">
                          <span>$</span>
                          <input
                            id="price"
                            disabled={!!imageFile}
                            type="number"
                            min="0.01"
                            max="10000000"
                            step="0.01"
                            value={price}
                            placeholder="160.00"
                            onChange={(e) => setPrice(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="category">Category</label>
                        <select
                          id="category"
                          disabled={!!imageFile}
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {[
                            "Shopping",
                            "Restaurants",
                            "Entertainment",
                            "Transportation",
                            "Other",
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="divider">
                      <span>or let Gemini read an image</span>
                    </div>
                    <label className="upload-zone" htmlFor="purchase-image">
                      <Upload size={22} />
                      <strong>
                        {imageFile
                          ? imageFile.name
                          : "Choose a product screenshot."}
                      </strong>
                      <span>
                        {data.profile.ai_enabled
                          ? "PNG, JPEG or WebP · up to 5 MB"
                          : "Enable Gemini in Settings to upload an image"}
                      </span>
                      <input
                        id="purchase-image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={!data.profile.ai_enabled}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5000000) {
                              setError("Choose an image under 5 MB.");
                              return;
                            }
                            setImageFile(file);
                            setPurchase(null);
                          }
                        }}
                      />
                    </label>
                    {imagePreview && (
                      <div className="image-preview">
                        <p className="fine-print">
                          Image mode: Gemini reads the image. You can confirm or
                          correct the extracted price afterward.
                        </p>
                        <img
                          src={imagePreview}
                          alt="Selected purchase to analyze"
                        />
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setImageFile(null)}
                        >
                          Remove image · use manual details
                        </button>
                      </div>
                    )}
                    {!data.profile.ai_enabled && (
                      <div className="ai-opt-in">
                        <p>Want image reading and AI explanations?</p>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setModal("settings")}
                        >
                          Enable Gemini in Settings <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                    <button className="primary full" disabled={!!busy}>
                      {busy === "analysis" ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <Sparkles size={18} />
                      )}{" "}
                      {busy === "analysis"
                        ? "Understanding your purchase…"
                        : "Show me the tradeoff"}
                    </button>
                    <p className="form-note">
                      <LockKeyhole size={12} />
                      AI requests send relevant context to Google. Images aren’t
                      saved.
                    </p>
                  </form>
                </section>
                <SavedChecks
                  revision={revision}
                  onChange={async () => {
                    await refresh();
                    setPurchase(null);
                    setCelebrate(null);
                  }}
                  onOpen={(id) =>
                    void run("resume", async () => {
                      const result = await api<Purchase>("/purchases/" + id);
                      setPurchase(result);
                      setPrice(String(result.detected_price ?? ""));
                      setCelebrate(null);
                      document
                        .querySelector(".purchase-result-column")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    })
                  }
                />
              </div>
              <div className="purchase-result-column">
                {!purchase && (
                  <section className="shield-intro">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="intro-shield">
                      <ShieldCheck size={66} strokeWidth={1.2} />
                    </div>
                    <span className="overline">A CLEARER WAY TO DECIDE</span>
                    <h2>
                      Your purchase.
                      <br />
                      Your priorities.
                      <br />
                      <em>The full picture.</em>
                    </h2>
                    <p>
                      See what this purchase means for your budget and the goal
                      you’re working toward.
                    </p>
                    <div className="intro-facts">
                      <span>
                        <Wallet size={17} />
                        {money(data.available)} available
                      </span>
                      <span>
                        <Target size={17} />
                        {money(goal.remaining)} to your goal
                      </span>
                    </div>
                    <p className="offline-note">
                      Enter a price to see the tradeoff. Enable Gemini in
                      Settings for image reading.
                    </p>
                  </section>
                )}
                {purchase && (
                  <>
                    <section className="card result-summary">
                      <AIStamp ai={purchase.ai} />
                      {data.profile.ai_enabled &&
                        purchase.ai.status !== "live" && (
                          <p className="offline-note">{purchase.ai.message}</p>
                        )}
                      <div className="purchase-title">
                        <div>
                          <span className="overline">HERE’S THE TRADEOFF</span>
                          <h2>{purchase.product_name}</h2>
                          <p>
                            {purchase.merchant || purchase.category}
                            {purchase.ai.status === "live"
                              ? ` · ${purchase.confidence} price confidence`
                              : ""}
                          </p>
                        </div>
                        <strong>
                          {purchase.detected_price === null
                            ? "—"
                            : money(purchase.detected_price, true)}
                        </strong>
                      </div>
                      <p>{purchase.summary}</p>
                      {!purchase.resolved && purchase.price_confirmed && (
                        <button
                          className="text-link"
                          onClick={() =>
                            setPurchase({ ...purchase, price_confirmed: false })
                          }
                        >
                          Edit price
                        </button>
                      )}
                      {purchase.tradeoffs.length > 0 && (
                        <ul className="tradeoff-list">
                          {purchase.tradeoffs.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      )}
                      {!purchase.price_confirmed && !purchase.resolved && (
                        <form
                          className="confirm-price"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void run("confirm", async () => {
                              setPurchase(
                                await post<Purchase>(
                                  "/purchases/" +
                                    purchase.id +
                                    "/confirm-price",
                                  { price },
                                ),
                              );
                              setPending(
                                await api<Purchase[]>("/purchases/pending"),
                              );
                              setRevision((v) => v + 1);
                            });
                          }}
                        >
                          <label htmlFor="confirm-price">
                            {purchase.detected_price === null
                              ? "Enter the missing price"
                              : "Check the detected price before deciding"}
                            <input
                              id="confirm-price"
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={price}
                              onChange={(e) => setPrice(e.target.value)}
                              required
                            />
                          </label>
                          <button className="secondary" disabled={!!busy}>
                            Confirm price
                          </button>
                        </form>
                      )}
                      {purchase.impact && (
                        <div
                          className={
                            "budget-callout " +
                            (!purchase.impact.within_budget ? "caution" : "")
                          }
                        >
                          <Wallet size={21} />
                          <span>
                            {purchase.impact.budget_percent === null ? (
                              data.budget === 0 ? (
                                "Set a spending budget in Settings to compare affordability."
                              ) : (
                                "No discretionary budget remains."
                              )
                            ) : (
                              <>
                                <strong>
                                  {purchase.impact.budget_percent}%
                                </strong>{" "}
                                of your remaining discretionary budget.
                              </>
                            )}
                            <small>
                              {purchase.impact.within_budget
                                ? "It fits your recorded budget. Here’s what it means for your goal."
                                : "This exceeds the discretionary amount remaining in your recorded budget."}
                            </small>
                          </span>
                        </div>
                      )}
                      <Why>
                        <p>{purchase.explanation}</p>
                        <ul>
                          <li>
                            Remaining discretionary budget:{" "}
                            {money(data.available)}
                          </li>
                          <li>Goal remaining: {money(goal.remaining)}</li>
                          <li>
                            Planned monthly contribution: {money(goal.monthly)}
                          </li>
                        </ul>
                        <p>
                          Projections assume a steady contribution and no other
                          changes.
                        </p>
                      </Why>
                    </section>
                    {purchase.impact && (
                      <section className="impact-card">
                        <div className="card-heading">
                          <span className="overline">
                            <Target size={17} />
                            GOAL IMPACT
                          </span>
                          <span className="subtle-pill">{goal.name}</span>
                        </div>
                        <h2>
                          {purchase.impact.delay_days === null ? (
                            "Set your monthly savings plan."
                          ) : purchase.impact.delay_days === 0 ? (
                            "Your goal is already within reach."
                          ) : (
                            <>
                              {purchase.impact.delay_days.toLocaleString()}{" "}
                              days.
                              <span> That’s the tradeoff.</span>
                            </>
                          )}
                        </h2>
                        <p>
                          If the money would otherwise go toward savings,
                          skipping preserves {money(purchase.impact.price)}{" "}
                          toward your goal. Buying diverts it from your savings
                          plan.
                        </p>
                        <div className="timelines">
                          <div>
                            <span>
                              <span className="line-dot olive" />
                              Preserve your plan
                            </span>
                            <strong>
                              {dayText(purchase.impact.baseline_days)}
                            </strong>
                            <div className="timeline-track">
                              <div
                                style={{
                                  width: purchase.impact.buying_days
                                    ? ((purchase.impact.baseline_days ?? 0) /
                                        purchase.impact.buying_days) *
                                        92 +
                                      "%"
                                    : "0%",
                                }}
                              />
                            </div>
                            <small>
                              {dateText(purchase.impact.baseline_date)}
                            </small>
                          </div>
                          <div>
                            <span>
                              <span className="line-dot grey" />
                              Buy at this price
                            </span>
                            <strong>
                              {dayText(purchase.impact.buying_days)}
                            </strong>
                            <div className="timeline-track muted-track">
                              <div
                                style={{
                                  width: purchase.impact.buying_days
                                    ? "92%"
                                    : "0%",
                                }}
                              />
                            </div>
                            <small>
                              {dateText(purchase.impact.buying_date)}
                            </small>
                          </div>
                        </div>
                        <p className="fine-print">
                          Illustrative dates from {dateText(data.profile.as_of)}{" "}
                          at {money(goal.monthly)}/month. Protecting money
                          records an intention to save. Confirmed savings change
                          only when you mark the money as saved in Activity.
                        </p>
                      </section>
                    )}
                    {celebrate !== null ? (
                      <section className="celebration" role="status">
                        <div className="success-circle">
                          <Check size={30} />
                        </div>
                        <span className="overline">
                          A LITTLE CLOSER TO WHAT MATTERS
                        </span>
                        <h2>You protected {money(celebrate)}.</h2>
                        <p>
                          {goal.name}: {money(goal.planned_saved)} if you set
                          aside the planned money.
                        </p>
                        <Progress value={goal.planned_progress} />
                        <p className="fine-print">
                          Next: set the money aside, then mark it as saved in
                          Activity.
                        </p>
                        <button
                          className="primary"
                          onClick={() => navigate("Activity")}
                        >
                          Review planned savings <ArrowRight size={17} />
                        </button>
                      </section>
                    ) : purchase.resolved ? (
                      <div className="success-banner">
                        <CheckCheck size={18} />
                        This decision has already been recorded.
                      </div>
                    ) : (
                      <>
                        <div
                          className="decision-actions"
                          aria-label="Choose your next step"
                        >
                          <button
                            className="secondary"
                            disabled={!purchase.price_confirmed}
                            onClick={() =>
                              document
                                .querySelector(".scenario-card")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                            }
                          >
                            Compare prices
                          </button>
                          <button
                            className="secondary"
                            disabled={!purchase.price_confirmed}
                            onClick={() => {
                              const panel =
                                document.querySelector<HTMLDetailsElement>(
                                  ".pause-plan",
                                );
                              if (panel) {
                                panel.open = true;
                                panel.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                              }
                            }}
                          >
                            Save for later
                          </button>
                          <button
                            className="primary"
                            disabled={!!busy || !purchase.price_confirmed}
                            onClick={() => void protect("purchase_skipped")}
                          >
                            <ShieldCheck size={18} />
                            Skip purchase & plan to save
                          </button>
                        </div>
                        {purchase.alternatives.length > 0 && (
                          <section className="card alternatives">
                            <div className="card-heading">
                              <div>
                                <h2>Same intention. A lighter price.</h2>
                                <p>Options worth considering</p>
                              </div>
                              <span className="subtle-pill">Demo catalog</span>
                            </div>
                            {purchase.alternatives.map((a, i) => (
                              <div className="alternative" key={a.id}>
                                <span className="alternative-number">
                                  0{i + 1}
                                </span>
                                <div>
                                  <h3>{a.name}</h3>
                                  <p>{a.description}</p>
                                  <small>
                                    {a.source} · illustrative price, not a live
                                    offer
                                  </small>
                                  <button
                                    className="text-link"
                                    disabled={
                                      !!busy || !purchase.price_confirmed
                                    }
                                    onClick={() =>
                                      void protect(
                                        "cheaper_alternative_selected",
                                        a.id,
                                      )
                                    }
                                  >
                                    Choose this & protect {money(a.savings)}{" "}
                                    <ArrowRight size={15} />
                                  </button>
                                </div>
                                <strong>{money(a.price)}</strong>
                              </div>
                            ))}
                          </section>
                        )}
                        {purchase.price_confirmed &&
                          purchase.detected_price !== null && (
                            <PurchaseTools
                              key={purchase.id + ":" + purchase.detected_price}
                              purchase={purchase}
                              onSaved={async () => {
                                setPending(
                                  await api<Purchase[]>("/purchases/pending"),
                                );
                                setRevision((v) => v + 1);
                              }}
                            />
                          )}
                        {!data.profile.demo && (
                          <details className="card own-alternative">
                            <summary>Record a cheaper option</summary>
                            <h2>Found a less expensive option?</h2>
                            <p>
                              Enter the price you found. We'll record the
                              difference in your savings plan.
                            </p>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                void protect(
                                  "cheaper_alternative_selected",
                                  undefined,
                                  {
                                    alternative_name: String(
                                      f.get("alternative_name"),
                                    ),
                                    alternative_price: String(
                                      f.get("alternative_price"),
                                    ),
                                  },
                                );
                              }}
                            >
                              <label>
                                Alternative name
                                <input
                                  name="alternative_name"
                                  required
                                  maxLength={160}
                                  placeholder="e.g. A refurbished pair"
                                />
                              </label>
                              <label>
                                Actual price (USD)
                                <input
                                  name="alternative_price"
                                  type="number"
                                  required
                                  min="0"
                                  max={Math.max(
                                    0,
                                    (purchase.detected_price ?? 0) - 0.01,
                                  )}
                                  step="0.01"
                                />
                              </label>
                              <button
                                className="secondary"
                                disabled={!!busy || !purchase.price_confirmed}
                              >
                                Choose this option & plan the difference
                              </button>
                            </form>
                          </details>
                        )}

                        <p className="fine-print centered">
                          You’re in control. These are options, not a verdict.
                          This records your decision. Move the money yourself,
                          then mark it as saved in Activity.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {page === "Financial Scan" && (
            <>
              <section className="scan-banner">
                <div className="scan-symbol">
                  <ScanLine size={36} />
                </div>
                <div>
                  <span className="overline">YOUR FINANCIAL HEALTH SCAN</span>
                  <h2>A fresh look at familiar spending.</h2>
                  <p>
                    {transactions.length}{" "}
                    {transactions.length === 1 ? "transaction" : "transactions"}{" "}
                    · {data.subscriptions.length} recurring subscriptions · one
                    clearer picture
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setModal("import")}
                >
                  <Upload size={16} />
                  Import CSV
                </button>
              </section>
              {busy === "scan" && (
                <Loading label="Looking for useful patterns. Your dashboard stays available…" />
              )}
              {scan ? (
                <>
                  <AIStamp ai={scan.ai} />
                  <CategoryReview
                    key={JSON.stringify(scan.suggestions)}
                    suggestions={scan.suggestions}
                    onApplied={async () => {
                      await refresh();
                      setScan(null);
                      setPurchase(null);
                      setToast(
                        "Selected categories applied. Run a new scan for updated insights.",
                      );
                    }}
                  />
                  {scan.ai.status !== "live" && (
                    <p className="offline-note">
                      {scan.ai.message} These opportunities come from your
                      recorded spending.
                    </p>
                  )}
                  {scan.insights.length === 0 && (
                    <p className="empty-note">
                      No specific opportunities surfaced from these records.
                      Keep adding transactions and scan again when you have more
                      history.
                    </p>
                  )}
                  <div className="insight-grid">
                    {scan.insights.map((s, i) => (
                      <section className="card insight-card" key={i}>
                        <span className="insight-index">0{i + 1}</span>
                        <span className="subtle-pill">
                          {s.category} · {s.priority} priority
                        </span>
                        <h2>{s.title}</h2>
                        <p>{s.description}</p>
                        {s.estimated_monthly_savings !== null && (
                          <div className="estimate">
                            {money(s.estimated_monthly_savings, true)}
                            <small>/month in charges to review</small>
                          </div>
                        )}
                        <button
                          className="text-link"
                          onClick={() => {
                            setFilter(s.category);
                            navigate("Activity");
                          }}
                        >
                          Review these transactions <ArrowRight size={15} />
                        </button>
                        <Why>
                          <p>{s.reason}</p>
                          {s.estimate_basis && <p>{s.estimate_basis}</p>}
                        </Why>
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <section className="card empty-scan">
                  <Sparkles size={24} />
                  <h2>Your next insight starts here.</h2>
                  <p>
                    {data.transaction_count
                      ? "Review your recorded spending for patterns and opportunities."
                      : "Add a transaction or import your statement from Overview to get started."}
                  </p>
                  <button
                    className="text-link"
                    disabled={!!busy || !data.transaction_count}
                    onClick={() => void financialScan()}
                  >
                    Run your first scan <ArrowRight size={16} />
                  </button>
                </section>
              )}
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Recurring subscriptions</h2>
                    <p>One similar charge per month in recent history</p>
                  </div>
                  <span className="subtle-pill">
                    {money(data.subscription_monthly, true)}/month
                  </span>
                </div>
                <p className="fine-print">
                  Cancel with the provider first. Record a cancellation here
                  only after you have confirmed it.
                </p>
                {data.subscriptions.length ? (
                  data.subscriptions.map((s, i) => {
                    const done = data.money_rescued.events.some(
                      (e) =>
                        e.id === "subscription:" + s.merchant.toLowerCase(),
                    );
                    return (
                      <div className="subscription" key={s.merchant}>
                        <span
                          className="merchant-icon"
                          style={{
                            background: colors[(i + 1) % colors.length],
                          }}
                        >
                          {s.merchant[0]}
                        </span>
                        <div>
                          <h3>{s.merchant}</h3>
                          <p>{s.occurrences} observed charges</p>
                        </div>
                        <strong>
                          {money(s.monthly, true)}
                          <small>/month</small>
                        </strong>
                        <button
                          className="secondary"
                          disabled={!!busy || done}
                          onClick={() =>
                            void run("subscription", async () => {
                              const r = await post<{
                                protected: number;
                                dashboard: Dashboard;
                              }>("/subscriptions/confirm-cancelled", {
                                merchant: s.merchant,
                              });
                              setData(r.dashboard);
                              setToast(
                                `Recorded ${money(r.protected, true)} in monthly savings.`,
                              );
                            })
                          }
                        >
                          {done ? (
                            <>
                              <Check size={16} />
                              Recorded
                            </>
                          ) : (
                            "I’ve cancelled this"
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p>No recurring subscriptions detected in this history.</p>
                )}
              </section>
              <div className="transparency-note">
                <ShieldCheck size={20} />
                <p>
                  <strong>Built from your recorded spending.</strong> Keep your
                  transactions up to date for a useful picture. Gemini adds
                  optional explanations. Approve suggested categories above
                  before they change your records.
                </p>
              </div>
            </>
          )}

          {page === "Gambling Guard" && guard && (
            <>
              <div className="guard-layout">
                <section className="card guard-settings">
                  <span className="section-icon">
                    <HeartHandshake size={23} />
                  </span>
                  <h2>A boundary you choose.</h2>
                  <p>
                    Gambling Guard is optional. Set a weekly spending limit and
                    create space to pause.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("guard-settings", async () => {
                        await post<Guard>("/gambling/settings", {
                          enabled: !guarded,
                          weekly_limit: limit,
                        });
                        const g = await api<Guard>(
                          "/gambling/status?proposed=" +
                            encodeURIComponent(proposed),
                        );
                        setGuard(g);
                        setToast(
                          g.enabled
                            ? "Gambling Guard is enabled."
                            : "Gambling Guard is off.",
                        );
                      });
                    }}
                  >
                    <label htmlFor="limit">Your weekly limit (USD)</label>
                    <div className="currency-field">
                      <span>$</span>
                      <input
                        id="limit"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={limit}
                        required
                        onChange={(e) => setLimit(e.target.value)}
                      />
                    </div>
                    <div className="guard-status">
                      <span className={"status-dot " + (guarded ? "on" : "")} />
                      {guarded
                        ? "Guard is enabled"
                        : "Guard is off — opt in when you’re ready"}
                    </div>
                    <button
                      className={guarded ? "secondary full" : "primary full"}
                      disabled={!!busy}
                    >
                      {guarded
                        ? "Turn off Gambling Guard"
                        : "Enable Gambling Guard"}
                    </button>
                    {guarded && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={!!busy}
                        onClick={() =>
                          void run("limit", async () => {
                            await post<Guard>("/gambling/settings", {
                              enabled: true,
                              weekly_limit: limit,
                            });
                            setGuard(
                              await api<Guard>(
                                "/gambling/status?proposed=" +
                                  encodeURIComponent(proposed),
                              ),
                            );
                            setToast("Your weekly limit has been updated.");
                          })
                        }
                      >
                        Save new limit
                      </button>
                    )}
                  </form>
                  <p className="fine-print">
                    This is a voluntary planning tool. It cannot block
                    transactions or access a betting account.
                  </p>
                </section>
                <section className="card guard-main">
                  <div className="card-heading">
                    <span className="overline">
                      THIS WEEK · FROM {dateText(guard.week_start)}
                    </span>
                    <span className="subtle-pill">
                      {guarded ? "Your chosen limit" : "Preview · guard off"}
                    </span>
                  </div>
                  <h2 className="guard-amount">
                    {money(guard.spent)}
                    <span> / {money(guard.limit)}</span>
                  </h2>
                  <p>of the weekly limit you chose</p>
                  <Progress value={guard.percent ?? 0} />
                  <div className="limit-caption">
                    <span>{guard.percent ?? 0}% used</span>
                    <strong>{money(guard.remaining)} remaining</strong>
                  </div>
                  <form
                    className="hypothetical"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("hypothetical", async () =>
                        setGuard(
                          await api<Guard>(
                            "/gambling/status?proposed=" +
                              encodeURIComponent(proposed),
                          ),
                        ),
                      );
                    }}
                  >
                    <label htmlFor="proposed">
                      Put another amount in perspective
                    </label>
                    <div>
                      <div className="currency-field">
                        <span>$</span>
                        <input
                          id="proposed"
                          type="number"
                          min="0"
                          step="0.01"
                          value={proposed}
                          onChange={(e) => setProposed(e.target.value)}
                          required
                        />
                      </div>
                      <button className="secondary" disabled={!!busy}>
                        See the impact
                      </button>
                    </div>
                  </form>
                  <div className="guard-message">
                    <HeartHandshake size={21} />
                    <p>
                      Another <strong>{money(guard.impact.price)}</strong> would{" "}
                      {guard.over_by > 0 ? (
                        <>
                          exceed your weekly limit by{" "}
                          <strong>{money(guard.over_by)}</strong>
                        </>
                      ) : (
                        "stay within your chosen limit"
                      )}
                      {guard.impact.delay_days !== null && (
                        <>
                          {" "}
                          and move your goal approximately{" "}
                          <strong>
                            {guard.impact.delay_days}{" "}
                            {guard.impact.delay_days === 1 ? "day" : "days"}
                          </strong>{" "}
                          farther away
                        </>
                      )}
                      . A pause is always an option.
                    </p>
                  </div>
                  {guard.cooldown_active &&
                  Date.parse(guard.cooldown_until ?? "") > now ? (
                    <div className="cooldown-active">
                      <Clock3 size={21} />
                      <div>
                        <strong>Your 24-hour pause is active.</strong>
                        <p>
                          Until{" "}
                          {new Date(guard.cooldown_until!).toLocaleString()}.
                          Give yourself some space.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="primary full"
                      disabled={!!busy || !guarded}
                      onClick={() =>
                        void run("cooldown", async () => {
                          await post<Guard>("/gambling/cooldown");
                          setGuard(
                            await api<Guard>(
                              "/gambling/status?proposed=" +
                                encodeURIComponent(proposed),
                            ),
                          );
                          setToast("Your voluntary 24-hour pause has started.");
                        })
                      }
                    >
                      <Clock3 size={17} />
                      Start a 24-hour cooling-off period
                    </button>
                  )}
                  <button
                    className="text-link"
                    disabled={!!busy || !guarded || guard.impact.price <= 0}
                    onClick={() =>
                      void run("redirect", async () => {
                        const p = await post<Purchase>("/ai/analyze-purchase", {
                          text: "Money redirected instead of gambling",
                          price: String(guard.impact.price),
                          category: "Gambling",
                          use_ai: false,
                        });
                        const r = await post<{
                          protected: number;
                          dashboard: Dashboard;
                        }>("/purchases/protect", {
                          purchase_id: p.id,
                          action: "money_redirected_to_goal",
                        });
                        setData(r.dashboard);
                        setToast(
                          `Protected ${money(r.protected)} in your savings plan. Confirm it in Activity after you set it aside.`,
                        );
                        setGuard(
                          await api<Guard>("/gambling/status?proposed=0"),
                        );
                        setProposed("0");
                      })
                    }
                  >
                    Put {money(guard.impact.price)} in my savings plan instead{" "}
                    <ArrowRight size={15} />
                  </button>
                  <Why>
                    <p>
                      This week’s recorded gambling transactions are compared
                      with your own limit. Goal impact uses your{" "}
                      {money(goal.monthly)} monthly savings plan. No diagnosis
                      or betting advice is involved.
                    </p>
                  </Why>
                </section>
              </div>
              <section className="card">
                <h2>This week’s gambling spending</h2>
                {guard.transactions.length ? (
                  <TransactionTable transactions={guard.transactions} />
                ) : (
                  <p>No gambling spending recorded this week.</p>
                )}
              </section>
              <section className="support-card">
                <HeartHandshake size={26} />
                <div>
                  <h2>Support is here, without judgment.</h2>
                  <p>U.S. National Problem Gambling Helpline</p>
                  <a className="helpline" href="tel:18006973738">
                    1-800-MY-RESET <ArrowUpRight size={19} />
                  </a>
                  <p className="fine-print">
                    SpendShield is a financial wellness tool, not medical
                    treatment.
                  </p>
                </div>
                <a
                  className="secondary"
                  href="https://www.ncpgambling.org/help-treatment/"
                  target="_blank"
                  rel="noreferrer"
                >
                  View support resources <ArrowUpRight size={16} />
                </a>
              </section>
            </>
          )}

          {page === "Activity" && (
            <>
              <div className="activity-stats">
                <Metric
                  label="Money Rescued this month"
                  value={money(data.money_rescued.this_month)}
                  icon={<ShieldCheck size={20} />}
                  note="Planned and confirmed amounts from your decisions"
                />
                <Metric
                  label="Projected annual recurring savings"
                  value={money(data.money_rescued.projected_annual_recurring)}
                  icon={<TrendingUp size={20} />}
                  note="Confirmed recurring cancellations × 12 only"
                />
              </div>
              <section className="card">
                <h2>Your intentional decisions</h2>
                {data.money_rescued.events.length ? (
                  data.money_rescued.events.map((e) => (
                    <div className="event-row" key={e.id}>
                      <span className="soft-icon">
                        <ShieldCheck size={19} />
                      </span>
                      <div>
                        <h3>{e.description}</h3>
                        <p>
                          {dateText(e.date)} · {e.type.replaceAll("_", " ")}
                        </p>
                      </div>
                      <strong>+{money(e.amount, true)}</strong>
                      <div className="decision-controls">
                        {e.confirmed ? (
                          <span className="saved-badge">
                            <Check size={14} />
                            Saved
                          </span>
                        ) : (
                          <button
                            className="secondary"
                            onClick={() => {
                              setConfirmEvent(e.id);
                              setModal("confirm-saved");
                            }}
                          >
                            Mark as saved
                          </button>
                        )}
                        {e.confirmed > 0 && (
                          <button
                            className="text-link"
                            onClick={() => {
                              setConfirmEvent(e.id);
                              setModal("unconfirm");
                            }}
                          >
                            Mark as not saved
                          </button>
                        )}
                        <button
                          className="text-link"
                          onClick={() => {
                            setConfirmEvent(e.id);
                            setModal("undo-decision");
                          }}
                        >
                          Undo decision
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>
                    No decisions yet. Check a purchase to see what you could
                    keep for your goal.
                  </p>
                )}
              </section>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Transaction history</h2>
                    <button className="text-link" onClick={addTransaction}>
                      <Plus size={16} />
                      Add transaction
                    </button>
                    <p>
                      {transactions.length} recorded{" "}
                      {transactions.length === 1
                        ? "transaction"
                        : "transactions"}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => setModal("import")}
                  >
                    <FileSpreadsheet size={16} />
                    Import CSV
                  </button>
                </div>
                <input
                  className="search-input"
                  aria-label="Filter transactions"
                  placeholder="Find a merchant or category…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <TransactionTable
                  onEdit={(t) => {
                    setEditingTransaction(t);
                    setModal("transaction");
                  }}
                  transactions={transactions.filter((t) =>
                    (t.merchant + " " + t.category)
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                  )}
                />
              </section>
            </>
          )}
          <footer>
            <span>
              <Shield size={14} />
              SpendShield <span className="footer-divider">/</span> Think before
              you spend.
            </span>
            <span>
              {data.profile.ai_enabled ? aiStatus : "AI is off"} · USD · Local
              profile
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={21} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        className={modal === "help" ? "guide-dialog" : ""}
        aria-label={
          modal === "help"
            ? "SpendShield guide"
            : "SpendShield settings and actions"
        }
        ref={modalRef}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="modal">
          <button
            className="modal-close icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "settings" && (
            <ProfileSettings
              data={data}
              onSaved={async () => {
                await refresh();
                setModal(null);
                setToast("Your settings are saved.");
              }}
              onBudget={() => setModal("budget")}
              onGoal={() => setModal("goal")}
              onRestore={() => setModal("restore")}
            />
          )}
          {modal === "transaction" && (
            <TransactionEditor
              transaction={editingTransaction}
              onSaved={() => changedData("Transaction updated.")}
            />
          )}
          {modal === "import" && <ImportTransactions onSaved={changedData} />}
          {modal === "confirm-saved" && (
            <>
              <ShieldCheck className="section-icon" />
              <h2>Have you set this money aside?</h2>
              <p>
                Only confirm after you have moved the money into savings
                yourself. SpendShield does not move money or connect to your
                bank.
              </p>
              <button
                className="primary full"
                disabled={!!busy}
                onClick={() =>
                  void run("confirm-saved", async () => {
                    await post(
                      "/events/" +
                        encodeURIComponent(confirmEvent ?? "") +
                        "/confirm-saved",
                    );
                    await refresh();
                    setModal(null);
                    setToast("Saved amount added to your goal.");
                  })
                }
              >
                Yes, I have saved it
              </button>
              <button className="secondary full" onClick={() => setModal(null)}>
                Not yet
              </button>
            </>
          )}
          {modal === "help" && <ProductGuide />}
          {modal === "restore" && (
            <RestoreBackup
              onRestored={async () => {
                await refresh();
                setScan(null);
                setPurchase(null);
                setImageFile(null);
                setCelebrate(null);
                setModal(null);
                setPage("Overview");
                setToast(
                  "Profile restored. Check your settings before enabling Gemini.",
                );
              }}
            />
          )}
          {(modal === "undo-decision" || modal === "unconfirm") && (
            <>
              <h2>
                {modal === "undo-decision"
                  ? "Undo this decision?"
                  : "Move this amount back to planned savings?"}
              </h2>
              <p>
                {modal === "undo-decision"
                  ? "This removes the amount from Money Rescued and from your confirmed goal balance if it was marked as saved. Its purchase check will reopen. A recorded subscription cancellation can be recorded again if needed."
                  : "This reduces confirmed goal savings by this decision’s amount and keeps it in your savings plan."}{" "}
                No money moves.
              </p>
              <button
                className="primary full"
                disabled={!!busy}
                onClick={() =>
                  void run("correct", async () => {
                    await post(
                      "/events/" +
                        encodeURIComponent(confirmEvent ?? "") +
                        (modal === "undo-decision" ? "/undo" : "/unconfirm"),
                    );
                    await refresh();
                    setPurchase(null);
                    setModal(null);
                    setToast("Decision corrected. Your totals are updated.");
                  })
                }
              >
                {modal === "undo-decision"
                  ? "Yes, undo decision"
                  : "Yes, mark as not saved"}
              </button>
              <button className="secondary full" onClick={() => setModal(null)}>
                Keep it unchanged
              </button>
            </>
          )}
          {modal === "goal" && (
            <>
              <Target className="section-icon" />
              <h2>A goal worth protecting.</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run("goal", async () => {
                    await post("/goals", {
                      name: f.get("name"),
                      target: f.get("target"),
                      current_saved: f.get("saved"),
                      monthly_contribution: f.get("monthly"),
                    });
                    await refresh();
                    setModal(null);
                    setPurchase(null);
                    setToast("Your savings plan is updated.");
                  });
                }}
              >
                <label>
                  Goal name
                  <input
                    name="name"
                    defaultValue={goal.name}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Target amount (USD)
                  <input
                    name="target"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={goal.target}
                    required
                  />
                </label>
                <label>
                  Current confirmed savings (USD)
                  <input
                    name="saved"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={goal.saved}
                    required
                  />
                </label>
                <label>
                  Planned monthly contribution (USD)
                  <input
                    name="monthly"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={goal.monthly}
                    required
                  />
                </label>
                <p className="fine-print">
                  Enter what you have actually saved. Planned decisions are
                  separate. Set zero monthly contribution to leave dates
                  unprojected.
                </p>
                <button className="primary full" disabled={!!busy}>
                  Save goal
                </button>
              </form>
            </>
          )}
          {modal === "budget" && (
            <>
              <Wallet className="section-icon" />
              <h2>Make room for your priorities.</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run("budget", async () => {
                    await post("/profile/budget", {
                      monthly_discretionary: f.get("budget"),
                    });
                    await refresh();
                    setModal(null);
                    setPurchase(null);
                    setScan(null);
                    setToast("Spending budget updated.");
                  });
                }}
              >
                <label>
                  Monthly discretionary budget (USD)
                  <input
                    name="budget"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={data.budget}
                    required
                  />
                </label>
                <p>
                  Includes shopping, restaurants, entertainment, gambling and
                  uncategorized expenses. Essentials and savings transfers are
                  separate.
                </p>
                <button className="primary full" disabled={!!busy}>
                  Save budget
                </button>
              </form>
            </>
          )}
          {error && (
            <p className="modal-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  note: ReactNode;
}) {
  return (
    <section className="metric">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <strong>{value}</strong>
      <div className="metric-note">{note}</div>
    </section>
  );
}
function TransactionTable({
  transactions,
  onEdit,
}: {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Category</th>
            <th>Amount</th>
            {onEdit && (
              <th>
                <span className="sr-only">Edit</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td>{dateText(t.date)}</td>
              <td>{t.merchant}</td>
              <td>
                <span className="category-pill">{t.category}</span>
              </td>
              <td className={t.amount_cents > 0 ? "income" : ""}>
                {money(t.amount_cents / 100, true)}
              </td>
              {onEdit && (
                <td>
                  <button
                    className="text-link"
                    aria-label={`Edit ${t.merchant}`}
                    onClick={() => onEdit(t)}
                  >
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && <p>No transactions match.</p>}
    </div>
  );
}
