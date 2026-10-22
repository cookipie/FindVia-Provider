# FindVia Provider

A mobile-first, accessible provider app for the FindVia service marketplace.

## Current status
- The deployed UI is still a preview; jobs, offers, profile edits, verification uploads, notifications and wallet requests are not yet live database features.
- Supabase Auth is connected in the frontend, but a successful frontend build does not prove email delivery or database policies are configured correctly.
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

The second migration hardens client-side permissions and initializes provider accounts. Adding a migration to GitHub does **not** execute it in Supabase. Verify both SQL scripts complete successfully before testing signup or database-backed flows.

## Build
Run `npm run build`; production files are written to `dist/`. GitHub Actions currently checks the frontend build and deployment; it does not run SQL integration tests.

## Planned milestones
1. Premium mobile-first interface and accessible navigation.
2. Supabase Auth and provider profile.
3. Service categories, service areas and verification documents.
4. Available jobs, offers, selection and active job lifecycle.
5. Secure real-money wallet, recharge requests and commission ledger.
6. Server-verified completion OTP and notifications.
7. Automated build checks, Android packaging, signing and Play Store preparation.

Financial actions must be implemented server-side and tested against the new database before production use.