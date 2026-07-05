# Kloppy

Domain: getkloppy.com

A legally distinct, cursed desktop assistant for people who miss weird software.

## Local Usage

Open `index.html` in a browser.

Open `whitepaper.html` for the technical white paper.

## Deployment

Push this repo to GitHub.

Enable GitHub Pages from the main branch.

Set the custom domain to getkloppy.com.

Configure DNS with the domain registrar separately.

## Launch Checklist

- [ ] Create GitHub repo
- [ ] Add remote
- [ ] Push main branch
- [ ] Enable Pages
- [ ] Add custom domain
- [ ] Configure DNS
- [ ] Create the $4.20 Stripe Payment Link using `STRIPE_SETUP.md`
- [ ] Paste the live `https://buy.stripe.com/...` link into `STORE.stripePaymentLink` in `index.html`
- [ ] Set the newsletter endpoint in the same `STORE` config (Formspree, Buttondown, etc.)
- [ ] Set up `hello@getkloppy.com` (footer contact link)
