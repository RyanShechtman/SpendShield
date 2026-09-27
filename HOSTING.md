# Publish SpendShield with private Gemini credentials

## What visitors experience

Open `https://ryanshechtman.github.io/SpendShield/` → automatic redirect to your hosted app → Continue with GitHub → personal setup on the first visit → the full app, including optional Gemini. Returning visitors stay signed in for up to seven days. Records follow their GitHub identity across devices. Settings provides Sign out. Visitors do not install Python or supply API keys.

GitHub Pages hosts only the entry page. The complete React app and Python API run together on Render. Keeping them on the same origin avoids third-party-cookie dependence. The browser address changes to the Render address. An unchanged branded address would require your own domain pointed at the hosted service.

## Current status

The deployment files and hosted-mode tests are prepared locally. This is not a live deployment. Render provisioning, a GitHub OAuth application, a fresh Gemini key, repository upload, and a live callback test remain required. No paid resources have been purchased or created.

## Owner setup

1. Create a Render account and connect the SpendShield GitHub repository. Upload this source first, including `render.yaml`, `backend/hosting.py`, `frontend/src/SessionGate.tsx`, and `.github/workflows/pages.yml`.
2. Create a **Blueprint** from that repository using `render.yaml`. Review the paid Starter service and persistent-disk cost before approving it. This configuration needs persistent storage; a free ephemeral filesystem would lose account records on redeploy.
3. Note the service's HTTPS URL. Set `PUBLIC_ORIGIN` to that exact origin, with no path, for example `https://your-service.onrender.com`. The name is assigned by Render; do not assume the example exists.
4. In GitHub Settings → Developer settings → OAuth Apps → New OAuth App, set the homepage to the service URL and the authorization callback to `https://your-service.onrender.com/auth/callback`. This is the app's user sign-in registration, separate from granting Codex repository access. The app requests no repository permissions.
5. Enter the OAuth Client ID and Client Secret into Render's private `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` environment settings. Never put the secret in GitHub source, the Pages workflow, or a frontend variable.
6. Replace the Gemini key previously shared in chat. Create its replacement in Google AI Studio, restrict it to the required Gemini API where supported, and put it only in Render's private `GEMINI_API_KEY` setting. Configure provider quotas/billing alerts as appropriate. Never paste it into a chat or repository. If an old key was ever committed, revoke it even if you later delete the file.
7. Deploy/redeploy after setting all required values. Hosted mode intentionally refuses to start with missing required settings. Check `/api/health`, then test the sign-in and first setup using the Render URL.
8. In the GitHub repository, add an **Actions variable** named `PUBLIC_APP_URL` containing the Render origin. This URL is public and contains no secret. Under Settings → Pages, select **GitHub Actions** as the source. Run **Publish SpendShield entry page** from the Actions tab. It validates the origin and publishes only a generated entry page, not the backend or `.env`.
9. Open the resulting Pages URL and complete the final verification below.

## Implemented protections

- Gemini and OAuth secrets are read only on the server. Public responses and backup exports do not include them.
- GitHub authorization-code sign-in uses random state, PKCE S256, short-lived one-use state records and verified GitHub user IDs. GitHub access tokens are not persisted.
- Session cookies are Secure, HttpOnly, SameSite=Lax and host-only. Only token hashes are stored in the server session database. Sign-out revokes the session.
- Each authenticated identity selects its own SQLite file using a server-derived identifier. User input cannot choose a database. Hosted mode refuses unauthenticated storage access.
- All financial API routes require authentication. Demo/test endpoints and API documentation routes are unavailable in hosted mode.
- Mutating requests require the configured exact origin and a custom request header. No cross-origin credential sharing is enabled.
- Hosted responses include anti-framing, MIME-sniffing, referrer, HTTPS and content-security headers. API and authentication responses are not cached.
- Persistent request limits restrict API traffic and AI analysis requests. Defaults: 6 analysis requests per minute per account, 30 per day per account, 300 per day across the service. These count endpoint requests, including manual requests to analysis endpoints and failed attempts; provider fallback may make more than one model call per request. They are not a dollar spending cap. Set Gemini provider quotas separately.
- Upload bodies are capped before multipart parsing; existing CSV, image and backup validation also applies.
- Render runs without HTTP access logging so OAuth query codes are not written by Uvicorn. Avoid enabling request-body/query logging in external monitoring.

These protections are tested application controls, not an independent penetration-test certification. The hosting operator has access to stored data. This is not end-to-end encrypted storage. Back up the persistent disk and restrict hosting-account access. Keep one service instance with its persistent disk; horizontal scaling requires a shared database design.

## Final verification before sharing

1. Signed out: dashboard, export and AI endpoints must reject access.
2. Sign in with two different GitHub accounts; each must have separate onboarding, transactions and saved purchases.
3. Enable Gemini for a test account and analyze a synthetic screenshot. Confirm the detected price and actual model status. Do not use private financial data for the first deployment test.
4. Sign out and confirm a refresh cannot show the prior dashboard. Sign back in and confirm records persist.
5. Redeploy the service and verify those records remain on the persistent disk.
6. Open the Pages link in a private browser and on a phone. Confirm the redirect and GitHub callback complete.
7. Export and restore a test backup. Confirm that the backup contains neither API keys nor another account's records.

## Sources

- [GitHub OAuth authorization, state and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render persistent disks and paid-service requirement](https://render.com/docs/disks)
- [GitHub Pages hosting limits](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
