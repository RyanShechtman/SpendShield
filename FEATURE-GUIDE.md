# SpendShield: complete feature guide

SpendShield helps you understand a purchase before spending, see its effect on your savings goal, and track the money you actually set aside. It starts with your own information and no invented balances.

## Start and personalize

After the installation steps in README, double-click **Start-SpendShield.cmd**. The app opens at http://127.0.0.1:8000. Leave its server window running while using it. On later launches it reuses an already running server.

Complete the three setup steps: preferred name, monthly discretionary spending budget, and one savings goal. Enter the goal name, target, amount already saved, and expected monthly contribution. You may leave optional budget/contribution fields blank and add them later. Gemini is optional.

The top-right **Settings** gear or your profile at the bottom of the sidebar lets you update your name, budget, goal and AI preference. Changing the saved balance replaces the current confirmed goal total; it does not add that balance again.

## Every feature and how to use it

| Feature | How to use it |
|---|---|
| Overview | Open **Overview** for recorded monthly income, expenses, discretionary budget left, savings-transfer rate, spending categories, recent spending trend and goal progress. Empty states explain what to add. Over-budget messages show the amount over your limit. |
| Goal projection | Enter a monthly savings contribution in Settings. Goal cards estimate the time and date needed at that contribution. Expand **Why am I seeing this?** for the calculation assumptions. |
| Add transactions | Select **Add transaction**, enter merchant, date, positive dollar amount and category. Choose Income for money received; other categories record money out. This records an actual transaction, not a future purchase. |
| Correct transactions | Open **Activity**, search/filter your entries, then select a row's edit control to change or remove it. Totals update from the corrected entries. |
| CSV template and import | Select **Import CSV**, download the blank template if needed, choose your file, inspect the preview and confirm. Imports append records and skip exact date/merchant/amount duplicates, including duplicates within the file. Nothing changes at preview. |
| Manual purchase check | Open **Purchase Shield**, enter the product, price and category, then **Show me the tradeoff**. Manual calculations work without Gemini. |
| Gemini text understanding | Enable Gemini in Settings when a server key is configured, then describe the purchase. Gemini interprets the description and provides explanations. The displayed status identifies live AI or fallback results. |
| Gemini image reading | In Purchase Shield, choose a product screenshot with Gemini enabled. Review the extracted item and confirm its price before recording a decision. Images are not stored by SpendShield. |
| Price correction | Use **Edit price** on an unresolved result to correct the price and recalculate its impact. |
| Purchase impact | Read the share of your remaining discretionary budget and the potential delay to your goal. These are computed in Python from your entries; Gemini does not calculate the money. Missing budget/contribution values are explained rather than invented. |
| Price comparison | Select **Compare prices**, move the **What if you spent less?** slider or type a lower price. See the difference you could set aside and the new goal delay. This is a preview and changes no records. |
| Target price | Select **Use this as my target price** from a lower-price comparison, or expand **Save a target and reminder** and enter a target below the original price. |
| Custom reminder | Select **Save for later**, choose a revisit interval from 1 to 168 hours and save. Due reminders appear inside the app, including an Overview prompt. These are not email/push notifications or retailer price alerts. |
| Saved purchase checks | Use the search box and pages in **Saved purchase checks**. Select **Review** to reopen one; **Archive** removes it from the active list. The **Archived** tab lets you restore it. |
| Alternative searches | Expand **Find alternatives on Google** and open a suggested search. Links open in a new tab. Prices and availability must be checked on the retailer's site. |
| Cheaper purchase decision | Expand **Record a cheaper option**, enter its name and verified lower price, then choose it. The difference becomes planned savings. This does not buy the product or record an expense; add the actual expense separately. |
| Skip a purchase | Select **Skip purchase & plan to save**. The full purchase amount becomes a savings intention, and the active check is resolved. |
| Confirm real savings | After you set the money aside yourself, open **Activity** and choose **Mark as saved** on the decision. Only this confirmation increases the goal balance. Confirming twice cannot double-count it. |
| Correct savings | **Mark as not saved** returns the amount to planned savings. **Undo decision** removes the decision and any confirmed amount and reopens its purchase check. Read the confirmation dialog before applying. Neither action moves real money. |
| Money Rescued and annual estimate | Overview/Activity summarize recorded avoided spending. Planned amounts are intentions, not verified bank savings. The annual recurring estimate uses cancelled monthly subscriptions multiplied by 12; one-off decisions are not annualized. |
| Financial Scan | Open **Financial Scan** and select **Run financial scan**. Review spending patterns, priorities and suggested actions. With AI off/unavailable, rule-based analysis remains available. Rerun after changing records to obtain fresh insights. |
| Approve category suggestions | Gemini may suggest categories for Other transactions. Select only the rows you agree with, then **Apply selected**. **Keep current categories** dismisses them. Records never change automatically. |
| Recurring subscriptions | Financial Scan detects one similar subscription charge per month, 20-40 days apart, in the last 90 days. Cancel with the provider first, then select **I've cancelled this**. This adds one month's charge to planned savings and a separate annual estimate. Undo the decision in Activity if needed. |
| Gambling Guard settings | Open **Gambling Guard**, choose a weekly limit and enable it. You can update the limit or turn it off anytime. It is voluntary and cannot block transactions or accounts. |
| Gambling impact preview | Enter a proposed amount and select **See the impact** to compare it with your chosen weekly limit and savings goal. Recorded gambling transactions for the current week appear below. |
| Cooling-off period | With the guard enabled, select **Start a 24-hour cooling-off period**. The app displays when the voluntary pause ends. |
| Redirect to a savings plan | Select **Put [amount] in my savings plan instead**. Confirm it in Activity only after setting the money aside yourself. |
| Support resources | Use the support links in Gambling Guard whether the guard is enabled or not. They connect you to external support; the app does not provide treatment or betting advice. |
| Export a backup | Open Settings and download your profile as JSON. It includes the profile, goal, transactions, decisions, purchase checks and guard settings. It never includes the server API key. |
| Restore a backup | In Settings, select **Restore a backup**, choose a SpendShield JSON backup, inspect its preview, acknowledge that it replaces current records and confirm. Invalid files are rejected before replacing data. Imported backups start with Gemini off. |
| Undo last restore | The restore dialog offers **Undo last restore** when a recovery snapshot exists. This recovers the previous profile once and replaces any edits made since the restore. Export first if you want to keep those edits. |
| Privacy controls | Turn Gemini on/off in Settings. Opted-in AI requests send relevant context/images to Google. Your API key stays on the server; your app records persist in local SQLite. |
| In-app instructions | Select **Guide** at the top and expand a topic. Contextual explanations, empty states, validation and confirmation dialogs provide help where actions happen. |
| Phone and keyboard use | The layout adapts to small screens with bottom navigation. Forms have labels, controls have visible focus, and optional purchase tools expand when needed. Reduced-motion preferences are respected. |

## Import rules and calculation details

CSV columns are `date,merchant,amount,category`; category is optional. Use UTF-8, dates in YYYY-MM-DD format, positive amounts for income and negative amounts for expenses/transfers. Zero amounts, future dates and refunds are unsupported. Maximum: 2 MB and 5,000 rows. Unknown expense categories become Other. Manually add separate genuine purchases that happen to share the same date, merchant and amount.

The discretionary budget covers Restaurants, Entertainment, Shopping, Gambling and Other. Rent, Groceries, Transportation, Subscriptions and Savings transfers are excluded. Savings rate is recorded Savings transfers divided by recorded income for the month; it is separate from the goal balance. Savings transfers do not also increase the goal automatically.

Goal projections use the remaining goal amount, the monthly contribution and a 30-day month without investment returns. Purchase impact assumes money spent would otherwise contribute to the goal. These are illustrative projections based on recorded information.

## Hosted accounts

When deployed using HOSTING.md, visitors sign in with GitHub and records are stored separately per account on the server. Settings includes Sign out. Visitors need no API key; Gemini remains optional. The GitHub Pages entry link forwards to the complete hosted app. The hosting setup has been prepared but not deployed.

## Local scope

This is a complete local, single-person USD workflow with one active goal. It has no bank connection, online sign-in, payment transfer, automatic cancellation, automatic retailer monitoring or background push notification service. Keep the server bound to localhost. All summaries depend on the completeness of your entries.

## Pay schedules and milestones

Open **My Plan**. Enter take-home pay per payment and choose weekly (52/year), every two weeks (26/year), twice a month (24/year), or monthly (12/year). Add monthly essentials and bills; your savings contribution comes from the goal settings. Save to see the annualized monthly average and the amount left for discretionary spending. Apply the suggested budget explicitly if it fits. This does not record income automatically: add actual paychecks as Income transactions.

In the same page, name a daily-review challenge or keep the suggestion and choose 7, 14 or 30 check-ins. Review your spending, choose a practical next step, then tick both statements and record today's review. Separate calendar dates are required. Missed days never reset progress; check-ins cannot be reused across challenges. Each badge can be awarded once. Badges have no monetary value and do not certify savings, abstinence, or recovery. They are self-reported habit recognition, not treatment. The server supplies dates in hosted mode; a local computer's clock and files cannot be made tamper-proof.

Salary settings are included in JSON backups. Habit milestones remain with the current account/installation when financial backups are restored and are not imported from uploaded files; back up the complete local data folder to preserve them when moving computers.

Gambling Guard now accepts a **$0 weekly limit** for people who choose not to gamble. Support resources remain available without completing any challenge.


## Achievement collection

Open **My Plan > Achievements** to browse 20 badges, their exact requirements, review progress and earned dates. Filter to Earned or Not yet earned. Choose this challenge selects its focus and duration; review the form and press Start my challenge. One challenge can be active at a time. Earned badges remain as a history of past actions.

- **Spending awareness:** review records and choose a helpful next step. Earn Steady start, Building habits and Thoughtful month at 7, 14 and 30 reviews respectively, in separate challenges.
- **Practice the pause:** review spending, identify a trigger and write a calmer response for next time. Earn Pause planner, Intentional choices and Room to reflect at 7, 14 and 30 reviews. No purchase or gambling is needed.
- **Know your budget:** review spending, compare remaining budget with upcoming needs, and choose an adjustment or confirm the plan is workable. Earn Budget navigator, Planning ahead and Confident planner at 7, 14 and 30 reviews.
- **Lifetime practice:** First reflection (1 review), Making space (10), Growing perspective (25), Lasting practice (50). Reviews from all challenges count, including past reviews and ended challenges.
- **Planning foundations:** Payday clarity for saving positive take-home pay; A plan in action for applying a pay-based budget when essentials and planned savings fit within positive expected pay. Existing users can save/apply their plan again to earn these.

Challenge names are customizable; requirements and minimum durations are fixed. Daily review claims remain self-reported. One calendar date can count only once across challenges, and each badge is awarded once. Lifetime milestones intentionally count those same reviews cumulatively. There are no rankings, random prizes, streak resets or financial rewards. Achievements stay inside My Plan and never block financial tools or support resources.


## SpendShield Live browser companion

My Plan now includes extension pairing and voluntary Shield Mode settings. The five additional Live badges reward protected decisions, cheaper alternatives, elapsed waits and chosen safeguards. See LIVE-GUIDE.md for installation, every extension action, privacy and the isolated judge demonstration. Existing financial tools continue to work without the extension.


## Color themes

Open Settings and scroll to **Make it your space**. Choose Garden (mint/gold), Ocean (blue/sea glass), Iris (lilac/violet), or Sunset (peach/terracotta). The change appears immediately and is remembered on the current browser, separate from financial backups. All four are light themes with saturated goal cards and softly tinted dashboard cards. Reduced-motion preferences are respected.


Three optional reward palettes unlock from the existing lifetime review achievements: **Bloom** at 1 daily review, **Aurora** at 10, and **Starlight** at 25. Record reviews in any My Plan challenge on separate dates; earlier reviews count and missed days do not reset progress. Settings shows locked palettes and progress. The corresponding achievement cards name their theme rewards. Four base themes remain freely available. Reward availability is checked against this profile’s achievements when restoring a saved reward theme; if the check is unavailable, Garden is used temporarily. Themes remain cosmetic and do not unlock financial tools.
