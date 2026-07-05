# Stripe Setup

Use Stripe Payment Links for the Kloppy MVP fund. This keeps checkout hosted by Stripe and avoids putting secret API keys in this static site.

## One Time Setup

1. Create or open your Stripe account.
2. In the Stripe Dashboard, go to **Payment Links**.
3. Create a new standard price payment link.
4. Add a product named `Kloppy MVP Fund`.
5. Set the price to `4.20 USD`, one time.
6. In the payment link settings, collect customer email.
7. In the payment link settings, set the post payment behavior to either Stripe confirmation or redirect back to `https://getkloppy.com`.
8. Copy the live `https://buy.stripe.com/...` payment link.
9. Open `index.html`.
10. Paste the live link into `STORE.stripePaymentLink`.
11. Deploy the site.
12. Click every `Make it right, $4.20` or `Fund the comeback` button on the live site and confirm each one opens Stripe Checkout.

## Optional Tracking

The site appends these values to the Stripe link automatically:

```text
utm_source=getkloppy.com
utm_medium=website
utm_campaign=kloppy_mvp_v1_fund
client_reference_id=kloppy_mvp_v1_fund
```

Stripe can use those values for campaign tracking and reconciliation.

## Fulfillment Workflow

1. Turn on Stripe email receipts in your Stripe settings.
2. Watch successful payments in the Stripe Dashboard.
3. For the MVP fund phase, treat each successful payment as a supporter record.
4. When V1 is ready, export paid customer emails from Stripe and send the launch download link.
5. Later, add webhooks only if you want automatic fulfillment.

## Safety Rule

Only paste a public `https://buy.stripe.com/...` link into `index.html`.

Never paste a Stripe secret key into this repo or into a public web page.
