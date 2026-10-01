# HoopCheck
Next.js frontend for the HoopCheck overseas-player review platform.

## Run locally
1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase publishable key, Stripe secret key, app URL and webhook secret.
3. Add the Premium Stripe price ID once Premium is created.
4. `npm install`
5. `npm run dev`

## Deploy to Vercel
Import this GitHub repository into Vercel and add the same environment variables in Project Settings → Environment Variables.

## Current Stripe price
Pro: `price_1ULOQmPfOHVXLGd2w1Nlen2E` ($7.99/month).

Do not commit `.env.local` or secret keys.
