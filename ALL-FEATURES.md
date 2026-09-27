# SpendShield — updated complete feature list

SpendShield is a local USD spending planner with optional Gemini interpretation and a Chrome companion. It tracks decisions; it does not access bank accounts or move money.

## Personal setup and money management

1. **Personal onboarding:** name, monthly discretionary budget, named savings goal, target, existing savings and planned monthly contribution. New personal installations start empty.
2. **Editable profile:** update name, budget, goal and AI preference through Settings.
3. **Dashboard:** current-month recorded income, expenses, savings-transfer rate, discretionary spending/remaining budget, over-budget amounts, category breakdown, recent weekly trend, goal progress and projected completion date.
4. **Income/pay planning:** weekly, every two weeks, twice monthly, or monthly take-home pay; monthly essentials; annualized monthly income; savings allocation; shortfall warnings; explicitly apply the suggested discretionary budget. Expected salary never automatically creates an Income transaction.
5. **Manual transactions:** add, edit and delete dated income/expenses by merchant, amount and category; search/filter Activity.
6. **CSV import:** downloadable template, preview before applying, append, category handling, and duplicate prevention.
7. **Savings goal scenarios:** deterministic time/date projections and explanations based on the current recorded goal and monthly contribution.

## Purchase Shield and recorded savings

8. **Manual purchase check:** product, confirmed USD price, category and deterministic budget/goal impact.
9. **Gemini text interpretation:** optional product understanding and qualitative tradeoffs; visible live/fallback status.
10. **Gemini screenshot interpretation:** extract product and price from supported images, then require price confirmation. No image is stored by the app.
11. **Price correction:** change an unresolved check's price and recalculate.
12. **Interactive lower-price comparison:** slider or numeric entry with calculated savings difference and goal-delay change.
13. **Target price:** save a lower desired price for later review; no automated retailer monitoring.
14. **Purchase waits/reminders:** choose 1–168 hours, save the check and see due reminders in the app.
15. **Saved checks:** search, pagination, reopen, archive and restore.
16. **Alternative searches:** open a relevant Google search; verify actual retailer prices yourself.
17. **Cheaper-option recording:** enter the alternative name and verified lower price; record only the difference as planned savings.
18. **Skipped purchases:** record the full avoided amount as a savings intention.
19. **Money Rescued:** monthly and total recorded avoided spending; a separate annualized estimate for recurring cancelled subscriptions.
20. **Actual-savings confirmation:** Mark as saved only after you have set the money aside. This updates confirmed goal progress without double-counting repeated clicks.
21. **Correction and undo:** mark savings unconfirmed, undo decisions, and reopen related checks. No action transfers money.

## Financial Scan and Gambling Guard

22. **Spending analysis:** deterministic patterns and optional Gemini insights, with honest fallback if AI is unavailable.
23. **Category review:** suggestions for Other transactions; select and approve changes explicitly, with stale-record validation.
24. **Recurring subscriptions:** detect similar monthly charges and show their cost; record cancellation only after cancelling with the provider.
25. **Voluntary Gambling Guard:** enable/disable, choose a weekly limit including $0, inspect recorded weekly spending and remaining allowance.
26. **Hypothetical spending preview:** compare an amount with the chosen limit and goal projection; no betting advice or odds.
27. **24-hour gambling cooldown:** a voluntary pause with its remaining time.
28. **Redirect to goal:** record a hypothetical amount as protected instead of gambling; confirm actual savings separately.
29. **Support links:** confidential external gambling support remains available without completing challenges.

## Challenges and 20 achievements

30. **Three challenge tracks:** Spending awareness, Practice the pause, Know your budget. Choose 7, 14 or 30 separate daily reviews; customize the name while requirements stay fixed.
31. **Daily reviews:** two confirmation statements per review screen, one recorded date across challenges, no backdating in the API, no repeated-click farming and no missed-day penalty. End an active challenge without losing earned badges.
32. **Achievement collection:** My Plan → Achievements; all/earned/not-yet-earned filters, exact unlock rules, progress, dates, and direct links to the relevant action.
33. **Nine challenge badges:** Steady start, Building habits, Thoughtful month; Pause planner, Intentional choices, Room to reflect; Budget navigator, Planning ahead, Confident planner.
34. **Four lifetime-review badges:** First reflection (1), Making space (10), Growing perspective (25), Lasting practice (50).
35. **Two planning badges:** Payday clarity for a positive pay plan; A plan in action for applying a pay-based budget that fits income.
36. **Five Live badges:** First Shield, Smart Swap, Goal Guardian, Room to decide, A safeguard chosen. Badges reward recorded safeguards and planning actions, never gambling activity. They have no monetary value, rankings, random prizes or recovery claims.

## SpendShield Live — Chrome extension

37. **Relevant-page detection:** product, cart/checkout and likely gambling pages using bounded DOM/metadata extraction. Configurable gambling domains. A Chrome icon action can request analysis explicitly.
38. **Optional Gemini page interpretation:** sanitized, limited context only when useful; confident deterministic extraction avoids an AI call. Automatic shopping interpretation is off by default.
39. **Floating purchase overlay:** collapsible/dismissible, confirmed USD total, remaining-budget percentage, goal progress and deterministic timing tradeoff.
40. **Protect this money:** reuse the existing purchase/decision ledger and Money Rescued; a restrained success state and planned-goal visualization.
41. **Cheaper alternatives in the overlay:** search and record a verified actual price; the isolated demo uses the existing labeled fictional catalog, including $119 headphones. Difference is calculated server-side.
42. **Persistent purchase waits:** default 24 hours, configurable 1–168; revisit recognition, remaining time, continue waiting, protect, or continue anyway.
43. **On-page Gambling Guard:** own weekly limit/spend/remaining amount, user-entered hypothetical amount, exceedance and goal impact. No wager/payment fields are read.
44. **Voluntary Shield Mode:** user-selected covering conditions at weekly limit and/or during a cooldown; full-page intervention only when opted in. Disable through settings or Chrome. Cached active safeguards work offline where possible; underlying page is inert while covered.
45. **On-page redirect:** mark an amount protected toward the existing goal, with no claim of a real transfer.
46. **Popup:** monthly Money Rescued, confirmed/planned goal amounts, available budget, Guard/Shield status, open-app/check-page controls, purchase/Guard toggles and start cooldown.
47. **Extension settings and app pairing:** local backend URL, paired extension ID, purchase insights, automatic interpretation, Guard/limit, Shield conditions, waiting duration and custom gambling domains. Main app also exposes pairing and safeguards.
48. **Dashboard synchronization:** refresh on focus and periodically while visible so Live decisions appear in the same dashboard/Activity.
49. **Controlled presentation pages:** fictional product ($179 headphones), checkout/cart, and sportsbook. Separate resettable demo profile yields a reproducible $60 + $30 = $90 flow without touching personal finances.
50. **Resilient browser behavior:** bounded/debounced inspection, short classification cache, clear connection errors, dismissible ordinary-shopping failures, no page scripts executed from AI output, and a closed shadow overlay.

## Data, access and delivery

51. **JSON export:** profile, pay plan, goal, transactions, decisions, purchase checks/timers and Gambling Guard. API keys are excluded.
52. **Validated restore:** preview and explicit replacement; imported AI starts off; one undo of the last restore. Live settings/pairing and achievements stay with the installation and are not imported from financial JSON backups. Back up the full local data folder to move the complete installation state.
53. **Local persistence and privacy:** SQLite; backend-only API credentials; Gemini opt-in; no secrets in downloadable app/extension ZIPs.
54. **Responsive and accessible UI:** small-screen layouts, keyboard labels/focus, explanatory empty states, validation, confirmations and reduced-motion support. Desktop Chrome is required for the extension.
55. **In-app Guide and written guides:** contextual explanations, FEATURE-GUIDE.md, LIVE-GUIDE.md and judging guide.
56. **Windows portable app:** bundled runtime, one-file launch, optional private Gemini setup, stable-port Live launcher, standalone extension and isolated-demo launcher. Source setup/build instructions are included.
57. **Prepared hosted mode (not deployed):** GitHub sign-in, per-account databases, private server Gemini credentials, sessions and rate limits; Render configuration and GitHub Pages redirect setup. The extension currently connects only to the local mode.

Full usage instructions: FEATURE-GUIDE.md for the main app and LIVE-GUIDE.md for extension installation, every Live action, the three-minute presentation and limitations.

58. **Color themes and visual accents:** Settings → Make it your space offers Garden, Ocean, Iris and Sunset. Browser-local persistence, coordinated navigation/buttons, gradient goal cards, tinted metric cards and badge highlights; financial behavior is unchanged.

59. **Unlockable theme rewards:** Bloom for 1 daily review, Aurora for 10, Starlight for 25. Uses existing lifetime badges, includes historical reviews, displays locked-state progress, and restores selected reward palettes after checking profile achievements. All four base palettes remain available without achievements.
