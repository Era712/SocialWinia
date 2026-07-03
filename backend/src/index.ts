import express from 'express';
import { config } from 'dotenv';
import { startScraperCron } from './cron';
import { isOpenAIConfigured } from './config/openai';
import { isScrapingBeeConfigured } from './config/scrapingbee';
import { isSupabaseConfigured, supabase } from './config/supabase';
import { isStripeConfigured, stripe } from './config/stripe';
import { processRawPosts, runGiveawayPipeline } from './pipeline/giveaway-pipeline';

config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://social-winia.vercel.app',
    'https://socialwinia.com',
    'https://www.socialwinia.com',
  ].filter(Boolean)
);

function isAllowedOrigin(origin?: string) {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return allowedOrigins.has(origin) || url.hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

app.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured || !webhookSecret) {
    res.status(400).json({ error: 'Stripe webhook is not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: 'Missing Stripe signature' });
    return;
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const customerEmail = session.customer_details?.email || session.customer_email || session.metadata?.email;

      const update = {
        subscription_status: 'active',
        stripe_customer_id: customerId ?? null,
        updated_at: new Date().toISOString(),
      };

      const query = supabase.from('user_profiles').update(update);

      if (userId) {
        await query.eq('id', userId);
      } else if (customerEmail) {
        await query.eq('email', customerEmail);
      }
    }

    if (
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.paused' ||
      event.type === 'invoice.payment_failed'
    ) {
      const payload = event.data.object;
      const customerId = typeof payload.customer === 'string' ? payload.customer : payload.customer?.id;

      if (customerId) {
        await supabase
          .from('user_profiles')
          .update({
            subscription_status: event.type === 'invoice.payment_failed' ? 'past_due' : 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
      }
    }

    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe webhook';
    console.error('Stripe webhook failed:', message);
    res.status(400).json({ error: 'Invalid Stripe webhook' });
  }
});

app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-scrape-secret');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      openai: isOpenAIConfigured,
      scrapingbee: isScrapingBeeConfigured,
      stripe: isStripeConfigured,
      supabase: isSupabaseConfigured,
    },
  });
});

app.get('/giveaways', async (req, res) => {
  if (!isSupabaseConfigured) {
    res.json({ giveaways: [], source: 'not_configured' });
    return;
  }

  const { platform, category, status, minValue = '0', maxValue = '10000' } = req.query;

  let query = supabase
    .from('giveaways')
    .select('*')
    .gte('prize_value_chf', Number(minValue))
    .order('scraped_at', { ascending: false })
    .limit(100);

  if (Number(maxValue) < 10000) {
    query = query.lte('prize_value_chf', Number(maxValue));
  }

  if (platform && platform !== 'All' && platform !== 'Alle') {
    const platforms = String(platform)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (platforms.length > 0) {
      query = query.in('platform', platforms);
    }
  }

  if (category && category !== 'All' && category !== 'Alle') {
    const categories = String(category)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length > 0) {
      query = query.in('category', categories);
    }
  }

  if (status === 'visited') {
    query = query.eq('visited', true);
  } else if (status === 'new') {
    query = query.eq('visited', false);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ giveaways: data ?? [] });
});

app.get('/stats', async (_req, res) => {
  if (!isSupabaseConfigured) {
    res.json({
      source: 'not_configured',
      totalGiveaways: 0,
      todayGiveaways: 0,
      lastScrapedAt: null,
      platformCounts: [],
    });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('giveaways')
    .select('id, platform, scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1000);

  if (error) {
    res.status(500).json({ error: error.message || JSON.stringify(error) });
    return;
  }

  const rows = data ?? [];
  const platformCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const platform = row.platform || 'unknown';
    counts[platform] = (counts[platform] ?? 0) + 1;
    return counts;
  }, {});

  res.json({
    totalGiveaways: rows.length,
    todayGiveaways: rows.filter((row) => row.scraped_at && new Date(row.scraped_at) >= today).length,
    lastScrapedAt: rows[0]?.scraped_at ?? null,
    platformCounts: Object.entries(platformCounts)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
  });
});

app.post('/scrape/run', async (_req, res) => {
  const scrapeRunSecret = process.env.SCRAPE_RUN_SECRET;

  if (scrapeRunSecret && _req.headers['x-scrape-secret'] !== scrapeRunSecret) {
    res.status(401).json({ error: 'Unauthorized scrape request' });
    return;
  }

  try {
    const result = await runGiveawayPipeline();

    if (result.errors.some((error) => error.startsWith('Missing configuration'))) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scraping error';
    console.error('Manual scrape failed:', error);
    res.status(500).json({
      fallbackCount: 0,
      rawCount: 0,
      processedCount: 0,
      savedCount: 0,
      skippedCount: 0,
      errors: [message],
    });
  }
});

app.post('/scrape/sample', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Sample scrape is disabled in production' });
    return;
  }

  const result = await processRawPosts([
    {
      platform: 'reddit',
      title: 'Win a CHF 500 gaming setup bundle',
      description:
        'Giveaway for a mechanical keyboard, gaming mouse and CHF 500 store credit. To enter, follow our account and comment with your favorite game. Ends July 31, 2026.',
      url: 'https://example.com/socialwinia-sample-gaming-setup',
      organizer: 'socialwinia_sample',
      follower_count: 12000,
      is_verified: false,
      posted_at: new Date().toISOString(),
      full_text:
        'Win a CHF 500 gaming setup bundle. Follow, comment with your favorite game and tag one friend. Ends July 31, 2026. One winner.',
    },
  ]);

  res.json(result);
});

app.post('/billing/checkout-session', async (req, res) => {
  if (!isStripeConfigured || !process.env.STRIPE_PRICE_ID) {
    res.status(400).json({ error: 'Stripe is not configured' });
    return;
  }

  const { email, userId } = req.body as { email?: string; userId?: string };

  const sessionConfig: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: 'subscription',
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?checkout=success`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?checkout=cancelled`,
    metadata: {
      plan: 'premium',
      ...(email ? { email } : {}),
      ...(userId ? { userId } : {}),
    },
  };

  if (userId) {
    sessionConfig.client_reference_id = userId;
  }

  if (email) {
    sessionConfig.customer_email = email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create checkout session';
    console.error('Stripe checkout session failed:', message);
    res.status(502).json({ error: 'Unable to create checkout session' });
  }
});

app.post('/billing/portal-session', async (req, res) => {
  if (!isStripeConfigured) {
    res.status(400).json({ error: 'Stripe is not configured' });
    return;
  }

  const { email, userId } = req.body as { email?: string; userId?: string };

  if (!email && !userId) {
    res.status(400).json({ error: 'Missing account identifier' });
    return;
  }

  const { data: profile, error } = userId
    ? await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
    : await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('email', email)
        .single();

  if (error || !profile?.stripe_customer_id) {
    res.status(404).json({ error: 'No Stripe customer found for this account' });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?billing=returned`,
    });

    res.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create billing portal session';
    console.error('Stripe billing portal session failed:', message);
    res.status(502).json({ error: 'Unable to create billing portal session' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start cron job
  startScraperCron();
});
