# SocialWinia

All Giveaways. One App.

## Structure

- `frontend`: Next.js app for the feed, filters, profile, Stripe webhooks, and API routes.
- `backend`: Express API for scraping, Supabase, Stripe Checkout, and OneSignal.
- `supabase/schema.sql`: Database schema for the `giveaways` table.

## Run Locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default.
The backend runs on `http://localhost:3001` by default.

## Environment Variables

Copy the example files and add your real values:

- `frontend/.env.example` -> `frontend/.env.local`
- `backend/.env.example` -> `backend/.env`

Required services:

- Supabase URL and keys
- Stripe Secret Key, Webhook Secret and Price ID
- OpenAI API Key
- ScrapingBee API Key
- OneSignal App ID and REST API Key

## Real Data Pipeline

1. Run `supabase/schema.sql` in the Supabase SQL editor for a new database.
2. If the `giveaways` table already exists from an older version, run `supabase/migration-real-data.sql`.
3. Add the backend environment variables in Railway.
4. Add `NEXT_PUBLIC_API_URL` in Vercel so the frontend can reach the Railway backend.
5. Set `SCRAPE_RUN_SECRET` in Railway and the same value as `BACKEND_SCRAPE_SECRET` in Vercel.
6. Trigger a scrape with `POST /scrape/run` using the `x-scrape-secret` header, or let the backend cron job collect new giveaways.

The backend pipeline works like this:

- ScrapingBee collects raw social posts from the configured platform scrapers.
- OpenAI categorizes, extracts prize details, and validates each giveaway.
- Supabase stores active giveaways and updates existing rows by URL.
- The frontend reads live giveaways from `/giveaways` and falls back to demo data only when the backend has no usable response.

## User Flow

- Users sign in with Supabase Magic Link using email only.
- A `user_profiles` row stores trial and subscription status.
- The free trial lasts 4 hours from profile creation.
- After the trial expires, the app shows the Premium Required screen.
- Stripe Checkout is started from the upgrade buttons through the backend.
- The Stripe webhook updates `user_profiles.subscription_status` to `active`.
- Visited giveaways are stored per user in `visited_giveaways`.

## Deployment

### Railway Backend

Deploy the `backend` folder as its own Railway service.

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

Set these Railway variables:

```env
PORT=3001
FRONTEND_URL=https://YOUR-VERCEL-DOMAIN
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
OPENAI_API_KEY=
SCRAPINGBEE_API_KEY=
SCRAPER_PLATFORMS=reddit
SCRAPER_MAX_RAW_POSTS=5
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
SCRAPE_RUN_SECRET=
```

After Railway gives you a public backend domain, add this Stripe webhook endpoint:

```text
https://YOUR-RAILWAY-DOMAIN/billing/webhook
```

Listen for:

```text
checkout.session.completed
customer.subscription.deleted
customer.subscription.paused
invoice.payment_failed
```

Copy the Stripe signing secret that starts with `whsec_` into `STRIPE_WEBHOOK_SECRET`.

### Vercel Frontend

Deploy the `frontend` folder as its own Vercel project.

Set these Vercel variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-DOMAIN
OPENAI_API_KEY=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
BACKEND_SCRAPE_SECRET=
```

Use the same value for `BACKEND_SCRAPE_SECRET` in Vercel and `SCRAPE_RUN_SECRET` in Railway.

### Supabase

Run `supabase/schema.sql` in the Supabase SQL editor for a new database. If the table already exists from an older local build, run `supabase/migration-real-data.sql`.
