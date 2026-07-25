# Deploying HomeWard

HomeWard uses two public services:

| Service | Platform | Purpose |
| --- | --- | --- |
| `homeward-staging.vercel.app` | Vercel | Landing/referrer domain for Transak staging |
| `homeward-api.onrender.com` | Render | Express API, Transak session creation, Stellar and Supabase integration |

## 1. Push this repository to GitHub

Create a private GitHub repository, then push the current `main` branch. Never commit `.env` files or provider secrets.

## 2. Deploy the landing page to Vercel

1. Create a Vercel account and click **Add New → Project**.
2. Import the HomeWard GitHub repository.
3. Keep the project root as the repository root.
4. Deploy. Vercel reads `vercel.json` and serves the `web/` folder.
5. Choose a memorable project name, such as `homeward-staging`. Your initial address becomes `https://homeward-staging.vercel.app`.

Use the hostname only (without `https://`) as the staging Transak referrer domain:

```env
TRANSAK_REFERRER_DOMAIN=homeward-staging.vercel.app
```

Ask Transak to whitelist this exact hostname for the staging API key.

## 3. Deploy the API to Render

1. Create a Render account and click **New → Blueprint**.
2. Connect the GitHub repository and select the `main` branch.
3. Render detects `render.yaml`. Create the `homeward-api` service.
4. In the service **Environment** page, add the secret values marked `sync: false` in `render.yaml`.
5. Deploy and wait until the health check passes.
6. Copy the public URL, for example `https://homeward-api.onrender.com`.
7. Confirm it in a browser:

```text
https://homeward-api.onrender.com/api/health
```

For a reliable live judge demo, use a paid always-on Render instance. Free instances can sleep when idle.

## 4. Configure Transak staging

In Render environment variables set:

```env
TRANSAK_API_KEY=your_staging_key
TRANSAK_API_SECRET=your_staging_secret
TRANSAK_REFERRER_DOMAIN=homeward-staging.vercel.app
TRANSAK_USE_SANDBOX=true
TRANSAK_FIAT_CURRENCY=AED
TRANSAK_CRYPTO_CURRENCY_CODE=USDCstellar
```

After Render redeploys, verify:

```text
https://homeward-api.onrender.com/api/transak/status
```

The response must show `configured: true`.

## 5. Point the Expo app to Render

Update `twala-app/.env` locally:

```env
EXPO_PUBLIC_API_URL=https://homeward-api.onrender.com/api
```

Restart Expo with a clean cache:

```powershell
cd twala-app
npx expo start -c
```

## Production checklist

Before handling real money, complete Transak KYB, use a public Stellar wallet with the production USDC trustline, obtain written confirmation from the Uganda payout partner, register HTTPS webhooks, use a custom domain, and restrict CORS and secrets appropriately.
