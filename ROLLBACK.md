# Website Rollback Note

This rollback affects the static launch site and its documentation only. The
published v0.1.0 GitHub release is an independent artifact and must not be
deleted, moved, or retagged during a website rollback.

## Before deployment

Record the current remote `main` commit:

```bash
git fetch origin
git rev-parse origin/main
```

Keep that value with the deployment record.

## Roll back a merged launch pull request

From an up-to-date local `main`, create a revert commit for the pull request's
merge commit and push it:

```bash
git switch main
git pull --ff-only origin main
git revert -m 1 <launch-merge-commit>
git push origin main
```

If the pull request was squash-merged, omit `-m 1`:

```bash
git revert <launch-squash-commit>
git push origin main
```

Do not use `git reset --hard` or force-push shared `main`. After GitHub Pages
finishes deploying, verify the homepage, custom domain, release link, and Stripe
link. If only the payment destination is unsafe, clear `STORE.stripePaymentLink`
in a new reviewed commit; the site will keep downloads available and make the
contribution CTAs fall back to the on-page unavailable message.
