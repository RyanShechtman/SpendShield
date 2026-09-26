from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Category = Literal[
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
]


class PurchaseUnderstanding(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    product_name: str = Field(min_length=1, max_length=160)
    detected_price: float | None = Field(default=None, ge=0, le=10000000)
    merchant: str | None = Field(default=None, max_length=160)
    category: Category
    confidence: Literal["high", "medium", "low"]
    summary: str = Field(max_length=600)
    tradeoffs: list[str] = Field(max_length=4)
    alternative_queries: list[str] = Field(max_length=3)
    cooldown_recommendation: int = Field(ge=0, le=168)
    explanation: str = Field(max_length=800)


class Insight(BaseModel):
    title: str = Field(max_length=100)
    description: str = Field(max_length=500)
    category: Category
    priority: Literal["high", "medium", "low"]
    reason: str = Field(max_length=500)


class Insights(BaseModel):
    insights: list[Insight] = Field(max_length=4)


class Classification(BaseModel):
    merchant: str
    normalized_merchant: str
    category: Category
    confidence: float = Field(ge=0, le=1)


class Classifications(BaseModel):
    transactions: list[Classification]


class PurchaseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    price: str | None = None
    category: Category = "Shopping"
    use_ai: bool = True


class ConfirmPrice(BaseModel):
    price: str


class ProtectRequest(BaseModel):
    purchase_id: str
    action: Literal["purchase_skipped", "cheaper_alternative_selected", "money_redirected_to_goal"]
    alternative_id: str | None = None
    alternative_name: str | None = Field(default=None, max_length=160)
    alternative_price: str | None = None


class ProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    ai_enabled: bool = False


class SetupRequest(ProfileRequest):
    budget: str
    goal_name: str = Field(min_length=1, max_length=80)
    goal_target: str
    goal_saved: str
    goal_monthly: str


class TransactionRequest(BaseModel):
    date: str
    merchant: str = Field(min_length=1, max_length=160)
    amount: str
    category: Category


class GuardSettings(BaseModel):
    enabled: bool
    weekly_limit: str


class GoalRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    target: str
    monthly_contribution: str
    current_saved: str


class BudgetRequest(BaseModel):
    monthly_discretionary: str


class SubscriptionRequest(BaseModel):
    merchant: str = Field(min_length=1, max_length=160)
