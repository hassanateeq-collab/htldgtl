# Billing

Implements ADR 0004. Manual collection in PKR; no card processor. Billing state gates access at the database layer.

## Subscription
One `subscriptions` row per tenant. Status ∈ `trialing | active | past_due | read_only | suspended | cancelled`. A daily `pg_cron` job at **06:00 Asia/Karachi** evaluates transitions and records each in `subscription_events`. See the state diagram in ADR 0004.

Access mapping (`tenant_access_level()`): `trialing`/`active`/`past_due` → `full`; `read_only` → `read_only`; `suspended`/`cancelled` → `none`.

## Pricing
- Price = the plan's `price_pkr` **plus** the price of each active add-on, per month. All prices are data in `platform_plans` (and add-on prices), **seeded at 0** and edited in the admin console.
- One subscription per tenant. The base plan includes one property; `addon.multi_property` raises the property cap. Per-property **metered** pricing is deferred — v1 uses flat plan + add-on prices (most customers have one property).
- Currency PKR throughout; amounts `numeric(12,2)`, shown `PKR 98,000`.

## Invoices & payments
- `invoices` (period, `amount_pkr`, status `draft|sent|paid|void`, due_date) + `invoice_items`.
- `payments` (amount, `method ∈ bank_transfer|raast|jazzcash|easypaisa|cash`, reference, received_at, recorded_by). Recorded by the operator in the admin console.
- Recording a payment that covers the balance marks the invoice `paid`, extends `current_period_end`, and transitions the subscription to `active`.

> Note: `raast` is included (common in Pakistan); the pasted build prompt listed only bank/jazzcash/easypaisa/cash. Flagged for Hassan — trivial to drop if unwanted.

## Collection flow (operator)
1. Period end approaches → invoice generated (`draft` → `sent`).
2. Customer pays by bank/Raast/JazzCash/Easypaisa/cash.
3. Operator records the payment → invoice `paid`, period extended, status `active`.

## Reminders (templates are platform-level data; WhatsApp + email)
- 3 days before `current_period_end`.
- On the due day.
- On every state change (entered `past_due`, `read_only`, `suspended`).
Sent via the WhatsApp adapter (`addon.whatsapp` for guest messaging; billing reminders are platform-sent regardless) and Resend email.

## Dunning (enforced by the daily job + RLS)
`past_due` → after `grace_days` → `read_only` (view only) → after `read_only_days` → `suspended` (login shows the billing page only). `suspended` for 90 days → `cancelled` (export offered first, then purge policy). Data is never deleted before cancellation purge.

## Signup → trial (request → approve)
1. Marketing page posts to `platform_signup_requests` (hotel name, city, rooms, contact, email, phone), status `pending`. Hassan gets a WhatsApp notification.
2. Operator approves in admin → an edge function creates the tenant, one property, the owner membership, and a `trialing` subscription (plan = Trial, `trial_ends_at = now + trial_days`), and sends the owner their login link.
3. Rejected requests are retained for audit.

## The daily job does
- Evaluate every subscription's transitions; write `subscription_events`.
- Generate invoices for periods ending today.
- Send due/upcoming reminders.
- Apply dunning transitions (→ read_only, → suspended, → cancelled).
All idempotent (safe to re-run); all actions audited.
