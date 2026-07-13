# Stripe Setup

Use Stripe Payment Links for Kloppy's optional one-time $4.20 comeback
contribution. Kloppy is free, the payment unlocks nothing, and checkout stays on
Stripe so no secret API keys enter this static site.

## One Time Setup

1. Create or open your Stripe account.
2. In the Stripe Dashboard, go to **Payment Links**.
3. Create a new standard price payment link.
4. Add a product named `Kloppy Comeback Contribution`.
5. Set the price to `4.20 USD`, one time.
6. Collect only the information needed for payment and receipts. Do not collect
   shipping details or create an entitlement workflow.
7. Set post-payment behavior to Stripe confirmation or a redirect to
   `https://getkloppy.com/#download`.
8. Copy the live `https://buy.stripe.com/...` payment link.
9. Open `index.html` and paste it into `STORE.stripePaymentLink`.
10. Deploy the site.
11. Click every optional-contribution CTA on the live site. Confirm each opens
    the same Stripe-hosted checkout, shows exactly `4.20 USD` one time, and does
    not imply that payment is required to download Kloppy.

## Optional Tracking

The site appends these values to the Stripe link automatically:

```text
utm_source=getkloppy.com
utm_medium=website
utm_campaign=kloppy_comeback_contribution
client_reference_id=kloppy_comeback_contribution
```

Stripe can use those fixed campaign values for aggregate attribution and
reconciliation. They do not contain a visitor identifier or the Certificate of
Forgiveness name. The site has no analytics script and sends nothing to Stripe
until a visitor chooses a contribution link.

## Contribution Operations

1. Turn on Stripe receipts if desired and make the receipt clear that this is a
   voluntary contribution.
2. Reconcile successful contributions in Stripe.
3. Do not gate downloads, issue license keys, build supporter profiles, or add a
   fulfillment webhook for this contribution.
4. Apply the project's retention policy to any payment data available in Stripe.

## Safety Rule

Only paste a public `https://buy.stripe.com/...` link into `index.html`.

Never paste a Stripe secret key into this repo or into a public web page.
Never treat a successful contribution as an application purchase or a promise
of access to future releases.
