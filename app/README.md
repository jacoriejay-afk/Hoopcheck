# HoopCheck
HoopCheck is a review and research platform built for professional and overseas basketball players.
Players can research:
- Coaches
- Professional teams
- Leagues
- Player experiences and reviews
## Memberships
### HoopCheck Pro
$7.99/month
Includes:
- Full coach ratings and reviews
- Full team ratings and reviews
- Full league ratings and reviews
- Coach research
- Team research
- League research
### HoopCheck Premium
$15.99/month
Includes everything in Pro, plus:
- Advanced research tools
- Expanded coach, team, and league insights
- Premium discovery features
- Priority access to new features
Subscriptions are processed through Stripe.
## Technology
- Next.js
- React
- TypeScript
- Supabase
- Stripe
- Vercel
## Environment Variables
Create a `.env.local` file for local development.
Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_PREMIUM_PRICE_ID=
NEXT_PUBLIC_SITE_URL=
```

Never commit .env.local or any secret keys to GitHub.

Stripe

Production checkout:

* Pro: $7.99/month
* Premium: $15.99/month

Production site:

https://hoopcheck-nine.vercel.app

Stripe webhook:

https://hoopcheck-nine.vercel.app/api/stripe/webhook

Webhook events currently used:

* checkout.session.completed
* invoice.paid
* invoice.payment_failed
* customer.subscription.updated
* customer.subscription.deleted

Review System

Reviews require:

* A registered account
* An active Pro or Premium subscription
* A valid review target
* A rating from 1–5
* Review content meeting the platform requirements

Reviews initially enter pending status and can be moderated by authorized administrators or moderators.

Users can report reviews that violate the Community Guidelines.

Before deploying moderation API changes, apply the SQL migration in
`supabase/migrations/20261003223700_secure_review_moderation.sql` to the
Supabase project. Keep `SUPABASE_SERVICE_ROLE_KEY` configured only as a
server-side environment variable; never expose it with a `NEXT_PUBLIC_` name.

Legal & Trust

HoopCheck currently includes:

* Terms of Service
* Privacy Policy
* Community Guidelines
* 18+ signup confirmation
* Terms acceptance tracking
* Review reporting
* Review moderation
* Subscription cancellation through Stripe Customer Portal

Development

Install dependencies:

npm install

Run the development server:

npm run dev

Build the application:

npm run build

Start the production server:

npm start

Deployment

HoopCheck is connected to GitHub and Vercel.

Production deployment should use the environment variables configured in Vercel.

Do not deploy until the final production checklist has been completed.

Project Structure

Hoopcheck/
├── app/
│   ├── admin/
│   ├── api/
│   │   └── stripe/
│   ├── coaches/
│   ├── dashboard/
│   ├── leagues/
│   ├── login/
│   ├── membership/
│   ├── privacy/
│   ├── search/
│   ├── signup/
│   ├── teams/
│   ├── terms/
│   ├── community-guidelines/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── supabase.ts
├── .env.example
├── .gitignore
├── next-env.d.ts
├── package.json
└── tsconfig.json

Built for basketball players.

**Commit that README, then reply `Done`.**
