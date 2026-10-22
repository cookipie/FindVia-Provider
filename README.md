# FindVia Provider

A mobile-first provider app for the FindVia service marketplace. The repository builds a web preview and a downloadable Android debug APK; the debug APK is for installation/testing and is not a Play Store release.

## Implemented in the repository
- Supabase authentication and profile/service-area editing.
- Job discovery, offer submission/history, secure matching and matched-only contact RPCs.
- Matched-work view, job start and server-verified completion OTP flow.
- Private provider-verification uploads and document status display.
- Wallet balance, ledger, recharge requests, commission charges and outstanding-commission display.
- Server-side commission posting on completed jobs and management-only recharge approval RPC.
- Notifications, support requests, Hindi/English toggle, responsive layouts and contextual Back navigation.
- GitHub Actions builds and deploys the Vite web preview to GitHub Pages.
- Capacitor Android wrapper and GitHub Actions workflow to produce an installable debug APK.

## Important limits
- A successful frontend deployment proves the app builds; it does not prove every database/RLS/storage flow works against the live Supabase project.
- Migrations through 017 have been reported successful by the project owner. This is owner-reported status; the app cannot independently inspect the live database from this repository. Still required: end-to-end tests with separate customer/provider/management accounts, including matching, OTP attempts/expiry, wallet settlement, recharge approval, RLS boundaries, provider verification anti-self-approval, and document privacy.
- The customer-side OTP generation and offer acceptance screens belong to the future Customer App. A full Management App UI has not yet been built; current management capabilities are database/RPC policies only.
- The workflow builds a **debug APK**, which is useful for installing and checking the app. It is not a signed release AAB and is not ready for Play Store publishing. A release signing key, release build, app listing, privacy policy and Play Console setup will still be required.
- Never store Supabase service-role keys in this app. Only the public publishable/anon key belongs in the client, protected by RLS and server-side functions.

## Download the Android test APK
1. Open the repository's **Actions** tab.
2. Open the latest successful **Build and publish Provider App preview** workflow run.
3. Under **Artifacts**, download `findvia-provider-debug-apk`.
4. Extract the ZIP and install `app-debug.apk` on an Android device. Android may ask you to allow installs from that browser/file manager; only install builds from this repository that you trust.

The workflow artifact is temporary and retained for 14 days. Each new push starts a fresh build.

## Web preview deployment
GitHub Pages must use **GitHub Actions** as its publishing source. The workflow builds the Vite app and deploys `dist/`.

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set the Supabase project URL and public publishable key.
4. Run `npm run dev`.

## Shared Supabase migrations
Apply migration files in `supabase/migrations` in filename order, using the same shared Supabase project for all three future apps. Migration SQL added to GitHub does **not** execute automatically in Supabase; each new migration still requires a separate Supabase SQL run. Keep settings such as commission rules and service categories centrally configurable rather than hardcoding them in each app.

## Remaining Provider App milestones
1. Verify the new Android build succeeds and download/install the debug APK.
2. Finish functional UI/security audit and test live Supabase flows with distinct customer/provider/management accounts.
3. Confirm responsive behavior, accessibility, language coverage and Back navigation on mobile/tablet.
4. Create a signed release build (AAB), then prepare Play Store listing and release checks.

After the Provider App is finished, build the Customer App and Management App against this same shared backend.
