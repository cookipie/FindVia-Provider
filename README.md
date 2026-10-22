# FindVia Provider

A mobile-first, accessible provider app for the FindVia service marketplace.

## Current status
- Supabase Auth, profile editing, multi-area/service selection, privacy-safe job discovery, offer submission/history, private verification uploads, wallet/ledger reads, UTR recharge requests, live notifications and support requests are wired in the frontend.
- These flows require the shared core migration and provider hardening migration to be successfully applied in Supabase. Initial categories and Jaipur service areas are seeded by migrations 003 and 004; migration 005 safely deactivates the accidentally proposed legacy generic areas and ensures Jaipur localities are active. Management will later control the full list; providers must be approved and available to receive jobs.
- Customer offer selection/matching, secure customer contact reveal, active-job lifecycle, completion OTP, server-side commission posting, and management review screens still need implementation and integration tests.
- A successful frontend build does not prove that migrations, storage policies, SMTP delivery, or database policies are configured correctly.
- Never store Supabase service-role keys in this app. Only the public anon/publishable key belongs in the client, protected by Row Level Security and server-side functions.

## Deployment
GitHub Pages must use **GitHub Actions** as its publishing source. The workflow builds the Vite app and deploys the generated `dist/` directory; do not publish the repository root directly.

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the new Supabase project URL and public anon/publishable key when ready.
4. Run `npm run dev`.

## Shared Supabase schema
Run the SQL files in `supabase/migrations` in filename order in the SQL Editor:
1. `202610210001_shared_core.sql`
2. `202610220002_provider_auth_and_rls_hardening.sql`

The second migration hardens client-side permissions, supports multiple provider service areas, creates private verification-document storage, and adds the provider profile-save and offer-discovery RPCs. Adding a migration to GitHub does **not** execute it in Supabase. Verify both SQL scripts complete successfully before testing signup or database-backed flows.

## Build
Run `npm run build`; production files are written to `dist/`. GitHub Actions currently checks the frontend build and deployment; it does not run SQL integration tests.

## Remaining milestones
1. Apply and verify the provider hardening migration in the shared Supabase project; run migrations 003–005 for service categories and Jaipur service areas.
2. Implement customer offer selection/matching and securely reveal customer contact only after matching.
3. Build active-job start/finish flow and server-verified completion OTP.
4. Add server-side commission calculation/posting and management review actions.
5. Build the Customer and Management apps against this same Supabase schema.
6. Add end-to-end database/RLS/storage tests, then package/sign the Android app and prepare Play Store publishing.

Financial actions must be implemented server-side and tested against the new database before production use.