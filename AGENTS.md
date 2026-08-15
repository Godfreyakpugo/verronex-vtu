# AGENTS.md

Nigerian VTU (virtual top-up) platform. Wallet-first: users fund a wallet, then buy data/airtime for any Nigerian number. React 19 + Vite frontend, hosted Supabase backend (auth + Postgres + edge functions), GladtidingsData is the active VTU provider (data and airtime); WazobiaNet is benched as a dormant fallback, not removed.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — Vite build (default Vercel build command)
- `npm run lint` — ESLint (flat config, v10). Lints only `**/*.{js,jsx}`; `dist` ignored; `.ts` edge functions are NOT linted
- No typecheck, no test framework exists.
- `node scripts/import-gladtidings-plans.cjs` — re-import data plans (see below)
- Edge functions (Deno): `supabase functions serve purchase-data` for local, `supabase functions deploy purchase-data` to deploy. Set function secrets with `supabase secrets set GLADTIDINGS_BASE_URL=... GLADTIDINGS_API_TOKEN=...`

## Environment

- Frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`. Missing vars make `src/lib/supabaseClient.js` swap in a noop client — app renders but all auth/DB calls silently no-op ("Supabase is not configured"). Set real values before debugging anything data-related.
- Also used at runtime (from README): `VITE_BANK_NAME`, `VITE_ACCOUNT_NAME`, `VITE_ACCOUNT_NUMBER`, `VITE_WHATSAPP_NUMBER`.
- `.env.example` documents the import-script env (`SERVICE_ROLE_KEY`, `PROJECT_URL`, `DEFAULT_MARKUP` / `DEFAULT_MARKUP_PERCENT`). Note `GLADTIDINGS_TOKEN` in `.env.example` is unused; the edge function reads `GLADTIDINGS_BASE_URL` and `GLADTIDINGS_API_TOKEN` instead — those are not in `.env.example`.
- Deploy to Vercel: `npm run build` + the `VITE_*` vars; `vercel.json` rewrites all routes to `/index.html` (SPA routing).

## Architecture / data flow

- Auth: `src/context/AuthContext.jsx` hydrates `profiles` and `wallets` rows on sign-in; `profile.is_admin` gates `/admin/*` routes in `src/App.jsx`.
- Purchase flow: `BuyData.jsx` fetches plans from `data_plans` (client-side filters/dedupes) → `supabase.functions.invoke("purchase-data", { planId, phoneNumber })` → edge function authenticates the caller, runs RPC `start_data_purchase` (locks wallet, checks balance, deducts, creates a pending transaction, returns `network_id`, `api_plan_id`, price), POSTs to Gladtidings, marks the transaction successful on provider `Status == "successful"`, otherwise runs RPC `refund_purchase`.
- **There are no SQL migrations in the repo** (`supabase/migrations` doesn't exist). Tables (`data_plans`, `wallets`, `transactions`, `profiles`) and RPCs (`start_data_purchase`, `refund_purchase`) live only in the remote Supabase project — apply schema changes manually there.
- `data_plans` has both `network` (display name) and `network_id` (provider numeric id); `api_plan_id` is the Gladtidings plan id; `selling_price` is what customers pay, `cost_price` is provider price.
- Import script is CommonJS (`.cjs`) because `package.json` sets `"type": "module"`. It reads `docs/api/gladtidings-products.json` and upserts `data_plans` on conflict `(provider, api_plan_id)`. Markup is fixed naira (`DEFAULT_MARKUP`, default 20) or percentage (`DEFAULT_MARKUP_PERCENT`).

## Gotchas

- `src/lib/wazobiaApi.js` is legacy Wazobia fallback code — it calls the `vtu-api` edge function whose `index.ts` is an empty stub. It is preserved for reference, but the active airtime page does not use it. `src/pages/dashboard/BuyAirtime.jsx` calls the `purchase-airtime` edge function (Gladtidings) instead. `purchase-data` and `purchase-airtime` are implemented and deployed; `vtu-api` remains an empty stub.
- Edge function error messages: supabase-js v2 puts the real body on `error.context` (a Response). `BuyData.jsx` has `extractFunctionErrorMessage()` showing the pattern to reuse.
- Edge functions use Deno with `npm:` imports (e.g. `npm:@supabase/supabase-js@2`); `config.toml` registers `vtu-api`, `gladtidings-plans`, and `purchase-airtime` (all verify_jwt=false). `purchase-data` is deployed but not registered in `config.toml`.
- Tailwind v4 is CSS-first (`@import "tailwindcss"` in `src/index.css`, theme via `@theme`). `tailwind.config.cjs` is vestigial — change fonts/colors in `index.css`, not the config.
- UI conventions: rounded cards via `GlassCard`, gradient `from-indigo-600 to-fuchsia-600` buttons/badges, lucide-react icons, font Plus Jakarta Sans. Match these in new pages.
- `docs/PROJECT_STATUS.md` is the accurate state-of-the-world doc; `ARCHITECTURE.md`, `DATABASE.md`, `ROADMAP.md`, `CHANGELOG.md`, `API_PROVIDERS.md` are unfilled placeholders.
