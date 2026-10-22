# FindVia Provider

A mobile-first provider app for the FindVia service marketplace. The current public deployment is a web preview hosted on GitHub Pages; it is not yet a signed Android release.

## Implemented in the repository
- Supabase authentication and profile/service-area editing.
- Job discovery, offer submission/history, secure matching and matched-only contact RPCs.
- Matched-work view, job start and server-verified completion OTP flow.
- Private provider-verification uploads and document status display.
- Wallet balance, ledger, recharge requests, commission charges and outstanding-commission display.
- Server-side commission posting on completed jobs and management-only recharge approval RPC.
- Notifications, support requests, Hindi/English toggle, responsive layouts and contextual Back navigation.
- GitHub Actions builds and deploys the Vite web preview to GitHub Pages.

## Important limits
- A successful frontend deployment proves the app builds; it does not prove every database/RLS/storage flow works against the live Supabase project.
- Migrations through 012 have been reported successful by the project owner. Migration 012 adds a critical guard that prevents providers from approving their own verification. This is owner-reported status; the app cannot independently inspect the live database from this repository. Still required: end-to-end tests with separate customer/provider/management accounts, including matching, OTP attempts/expiry, wallet settlement, recharge approval, RLS boundaries, provider verification anti-self-approval, and document privacy.
- The customer-side OTP generation and offer acceptance screens belong to the future Customer App. A full Management App UI has not yet been built; current management capabilities are database/RPC policies only.
- No Android APK/AAB has been built or signed yet, and Play Store publication has not happened.
- Never store Supabase service-role keys in this app. Only the public publishable/anon key belongs in the client, protected by RLS and server-side functions.

## Deployment
GitHub Pages must use **GitHub Actions** as its publishing source. The workflow builds the Vite app and deploys `dist/`.

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase project URL and public publishable key.
4. Run `npm run dev`.

## Shared Supabase migrations
Apply migration files in `supabase/migrations` in filename order, using the same shared Supabase project for all three future apps. Migration `202610220012_guard_provider_verification.sql` has been reported applied to the live project. Adding a SQL file to GitHub does **not** execute it in Supabase; each new migration still requires a separate Supabase SQL run. Keep settings such as commission rules and service categories centrally configurable rather than hardcoding them in each app.

## Remaining Provider App milestones
1. Finish functional UI/security audit and repair issues found.
2. Verify end-to-end behavior against Supabase using distinct test accounts and realistic failure cases.
3. Confirm responsive behavior, accessibility, language coverage and Back navigation on mobile/tablet.
4. Package and sign the Android app, then prepare the Play Store listing and release checks.

After the Provider App is finished, build the Customer App and Management App against this same shared backend.
