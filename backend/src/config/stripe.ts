import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

export const stripe: InstanceType<typeof Stripe> = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
});
