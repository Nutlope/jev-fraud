<h1 align="center">Jev + Kimi K3 for fraud detection</h1>

<p align="center">
  An open source demo that uses Jev to classify emails and Kimi K3 to review the uncertain ones.
</p>

<p align="center">
  <a href="https://x.com/nutlope/status/2100614659690713543">Watch the demo</a>
</p>

## How it works

Jev classifies 100 emails and returns a confidence score. Predictions at or above 95% are accepted. Anything below that goes to Kimi K3 for an independent review.

Click **Run live** to watch decisions arrive, see which emails get a second opinion, and track accuracy and inference costs. You can adjust the confidence threshold, inspect each email, and export the results.

Jev runs up to 20 calls at once, with a separate queue for up to 25 Kimi reviews. Both models see the original email. Dataset labels are only used to score their answers.

## Tech stack

- [Jev](https://www.typesafe.ai/) through [Vercel AI Gateway](https://vercel.com/ai-gateway) for classification and confidence
- [Kimi K3](https://www.together.ai/models/kimi-k3) on Together AI for second opinions
- Next.js App Router, React, Tailwind CSS, and Radix UI
- [DIFrauD](https://huggingface.co/datasets/difraud/difraud) for 100 real emails: 50 fraudulent and 50 legitimate

## Cloning & running

You'll need Node.js 22.13+ and npm.

1. Clone the repo and install dependencies:

   ```sh
   git clone https://github.com/Nutlope/jev-fraud.git
   cd jev-fraud
   npm install
   cp .env.example .env.local
   ```

2. Add your [Together AI key](https://api.together.ai/settings/api-keys) and [Vercel AI Gateway key](https://vercel.com/ai-gateway) to `.env.local`:

   ```env
   TOGETHER_API_KEY=your_together_key
   AI_GATEWAY_API_KEY=your_gateway_key
   ```

3. Start the app:

   ```sh
   npm run dev -- --port 3017
   ```

Open [localhost:3017](http://localhost:3017). Want to try it without keys? **10s replay** plays the included recording without making API calls.

To record a fresh run, use `npm run benchmark`, then refresh the page. This makes paid API calls and saves the results to `data/recording.json`. Let any live run finish first.

## Results

The included Together AI run finished in 6.1 seconds. Jev handled 70 emails on its own and sent 30 to Kimi. The combined pipeline classified 92 of 100 correctly.

The recorded total is about $0.102. Kimi costs are token-based estimates without cache discounts; the gateway reported $0 for Jev in this run. The dashboard labels estimated and unavailable costs. See [validation details](VALIDATION.md) for the breakdown.

These results come from a small, balanced sample. Confidence is separate from measured accuracy, and results vary between runs. The demo tweet shows an earlier run.

## Deploying to Vercel

Import the repo into Vercel using the Next.js preset and add both API keys as environment variables. The build command is `npm run build`.

Replay works by default. To enable paid live runs, set up Deployment Protection or authentication first, then set `ENABLE_LIVE_RUNS=true`. The live route requests a 300-second timeout, so check that your plan supports it.

## Development

```sh
npm test
npm run typecheck
npm run build
```

To reproduce the email sample, run `python3 scripts/sample-data.py`. Selection details are in [data/provenance.json](data/provenance.json).

## License

[MIT](license.md). See [third-party notices](THIRD_PARTY_NOTICES.md) for dataset attribution and branding.
