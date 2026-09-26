export type AI = { status: string; model: string | null; message: string };
export type Transaction = {
  id: number;
  date: string;
  merchant: string;
  amount_cents: number;
  category: string;
};
export type Goal = {
  name: string;
  saved: number;
  planned: number;
  planned_saved: number;
  planned_progress: number;
  target: number;
  progress: number;
  remaining: number;
  days: number | null;
  date: string | null;
  monthly: number;
};
export type Event = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  confirmed: number;
};
export type Dashboard = {
  profile: {
    name: string;
    first_name: string;
    role: string;
    as_of: string;
    demo: boolean;
    onboarded: boolean;
    ai_enabled: boolean;
  };
  transaction_count: number;
  month_transaction_count: number;
  latest_transaction: string | null;
  income: number;
  expenses: number;
  available: number;
  budget: number;
  discretionary_spent: number;
  over_budget: number;
  savings_rate: number | null;
  savings_transfers: number;
  subscription_monthly: number;
  categories: { name: string; value: number }[];
  subscriptions: {
    merchant: string;
    monthly: number;
    occurrences: number;
    reason: string;
  }[];
  trend: { week: string; amount: number }[];
  goal: Goal;
  money_rescued: {
    this_month: number;
    total: number;
    projected_annual_recurring: number;
    events: Event[];
  };
};
export type Impact = {
  price: number;
  budget_percent: number | null;
  available: number;
  within_budget: boolean;
  goal_remaining: number;
  baseline_days: number | null;
  buying_days: number | null;
  delay_days: number | null;
  baseline_date: string | null;
  buying_date: string | null;
  monthly_contribution: number;
};
export type Purchase = {
  id: string;
  product_name: string;
  detected_price: number | null;
  category: string;
  merchant: string | null;
  confidence: string;
  summary: string;
  tradeoffs: string[];
  explanation: string;
  cooldown_recommendation: number;
  alternative_queries: string[];
  target_price_cents?: number | null;
  reminder_hours?: number;
  price_confirmed: boolean;
  ai: AI;
  impact: Impact | null;
  resolved: boolean;
  wait_until?: string;
  alternatives: {
    id: string;
    name: string;
    price: number;
    savings: number;
    description: string;
    source: string;
  }[];
};
export type Guard = {
  enabled: boolean;
  spent: number;
  limit: number;
  remaining: number;
  over_by: number;
  percent: number | null;
  cooldown_active: boolean;
  cooldown_until: string | null;
  week_start: string;
  transactions: Transaction[];
  impact: Impact;
};
export type Scan = {
  ai: AI;
  classified_count: number;
  suggestions: {
    id: number;
    merchant: string;
    date: string;
    amount_cents: number;
    category: string;
    normalized_merchant: string;
    confidence: number;
  }[];
  insights: {
    title: string;
    description: string;
    category: string;
    priority: string;
    reason: string;
    estimated_monthly_savings: number | null;
    estimate_basis: string | null;
  }[];
  dashboard: Dashboard;
};
