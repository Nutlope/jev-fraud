# Relay — fraud intelligence

A 100-email, confidence-gated classification demo: Jev handles every email, and Kimi K3 independently reviews decisions below 95% confidence. Both fraud and legitimate predictions can escalate.

## Run locally

```sh
npm install
cp .env.example .env.local
# Set AI_GATEWAY_API_KEY and OPENROUTER_API_KEY in .env.local.
npm run dev -- --port 3017
```

Open http://localhost:3017. **Run live** streams new provider decisions; **10s replay** animates a previously recorded run and does not make paid requests. Replay is unavailable until a real run has been recorded. **Export results** downloads the visible run as JSON. Filter and click an email to inspect its full text, decision, route, review, label and usage.

To produce the durable recorded run:

```sh
npm run benchmark
```

This makes 100 Jev calls and Kimi calls for uncertain cases, with five emails in flight. It writes `data/recording.json`. Refresh the dashboard afterward. Do not run it simultaneously with a UI run. The replay preserves the recorded routing threshold and compresses event timing into 10 seconds; the original API latencies and costs remain unchanged.

## Data

[DIFrauD](https://huggingface.co/datasets/difraud/difraud), phishing **test** split: 100 actual corpus records, sampled with Python seed 42, stratified 50 fraud / 50 legitimate, from records between 120 and 6,000 characters. No text is truncated. This is a deliberately balanced demo, not an estimate of production fraud prevalence. This public benchmark may have appeared in model training; results are exploratory, not a contamination-controlled benchmark.

The dataset card describes the corpus as real emails, assigns 1 to deception and 0 to non-deception, and lists an MIT license. `data/provenance.json` records selection and source checksum. `sourceRow` is the one-based original test JSONL row. Labels are used only for evaluation and are never sent to either model. The task is phishing/fraud email classification, not credit-card transaction fraud.

## Models and routing

- Jev: `typesafe-ai/jev`, Vercel AI Gateway evaluation protocol v4. The request mirrors the official gateway SDK. Prompt and criteria live in `lib/pipeline.mjs`.
- Kimi: `moonshotai/kimi-k3`, OpenRouter, low reasoning effort, JSON schema output, 4,096 maximum output tokens. It sees only the original email, not Jev's answer or the label.
- Confidence: use the provider's `confidence` when present, including the gateway's `providerMetadata.typesafe.confidence.fraud` field. Some gateway versions expose only the class probabilities; in that case use the selected-class probability, explicitly recorded as `confidenceBasis`. These are distinct metrics and the email inspector identifies which one was returned. Neither is a guarantee of accuracy.
- Exact threshold: confidence **>= 0.95** accepts Jev; confidence **< 0.95** invokes Kimi. There are no hard-coded predictions or synthetic fallback results.
- A failed Kimi review remains unresolved. Invalid responses do not silently become legitimate or fall back to accepting Jev.
- No automatic retries: failures remain explicit, so billing cannot be concealed by retry loops.

## Accounting and metrics

Provider-reported costs are used when supplied. Otherwise, estimates use returned token counts and a September 17, 2026 pricing snapshot: Jev $0.042 per million input tokens, output free; Kimi $3/M input and $15/M output. Actual OpenRouter `usage.cost` includes its reported caching discounts. Reasoning tokens are billed within reported output usage. Unavailable usage is marked unknown, never fabricated. Costs from failed response parsing are retained when the provider supplied usage. In-flight aborted calls may still be billed and cannot be fully reconciled in the client.

The dashboard reports final accuracy against corpus labels, fraud recall, Jev-only accuracy, escalation count, decisions changed, fixes and regressions. It does not claim Kimi is always right or fabricate a savings comparison against an unrun all-Kimi baseline. A lower API-call count does not by itself establish dollar savings.

## Validation

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Tests cover the threshold boundary, escalation of low-confidence legitimate predictions, exclusion of ground truth from both provider inputs, accounting for failed paid calls, and unresolved review failures.

## Vercel deployment (when ready)

This is a standard Next.js App Router app. No Sites or Cloudflare runtime is required.

1. Import this folder/repository into Vercel with the Next.js framework preset.
2. Set `AI_GATEWAY_API_KEY` and `OPENROUTER_API_KEY` in Vercel environment variables.
3. Build command: `npm run build`. No custom output directory is needed.
4. The live route declares Node.js runtime and a 300-second maximum duration; ensure your Vercel plan supports it.

The recorded 100-email run ships with the app and needs no credentials for replay. Live inference uses server-side secrets. Keep the live app private with Vercel Deployment Protection or add authentication/rate limits before opening paid inference publicly. No Vercel deployment has been created.
