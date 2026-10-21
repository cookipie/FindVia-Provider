# FindVia Provider

A mobile-first, accessible provider app for the FindVia service marketplace.

## Current status
- Frontend foundation and responsive UI in progress.
- Demo data is for visual preview only.
- Authentication, provider verification, job actions, wallet transactions and OTP completion must be connected to the new Supabase project before real use.
- Never store Supabase service-role keys in this app. Only the public anon/publishable key belongs in the client, protected by Row Level Security and server-side functions.

## Deployment
GitHub Pages must use **GitHub Actions** as its publishing source. The workflow builds the Vite app and deploys the generated `dist/` directory; do not publish the repository root directly.

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the new Supabase project URL and public anon/publishable key when ready.
4. Run `npm run dev`.

## Build
Run `npm run build`; production files are written to `dist/`.

## Planned milestones
1. Premium mobile-first interface and accessible navigation.
2. Supabase Auth and provider profile.
3. Service categories, service areas and verification documents.
4. Available jobs, offers, selection and active job lifecycle.
5. Secure real-money wallet, recharge requests and commission ledger.
6. Server-verified completion OTP and notifications.
7. Automated build checks, Android packaging, signing and Play Store preparation.

Financial actions must be implemented server-side and tested against the new database before production use.