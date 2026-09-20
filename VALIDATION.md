# Release validation: September 19, 2026

- Providers: Jev through Vercel AI Gateway; Kimi K3 directly through Together AI.
- Concurrency: 20 Jev calls and 25 Kimi reviews in independent pools.
- Fresh recorded benchmark: all 100 completed in 6.114 seconds; 70 accepted directly, 30 reviewed, no failures. Jev median latency 256 ms; all Jev calls finished at 5.377 seconds.
- Accuracy: Jev 90/100; combined pipeline 92/100; two corrected decisions, no regressions; fraud recall 84%. This balanced 100-email sample is a demo, not a production-quality guarantee.
- Cost: $0.101775 total in the recording. All 30 Kimi costs are uncached list-price token estimates ($3/M input, $15/M output), not billed totals. Vercel AI Gateway reported zero Jev cost in this run; that is preserved, not replaced with a fabricated charge. Account credits and cache discounts may change actual billing.
- Together model ID, reasoning effort and strict JSON schema verified with a live smoke test. Together model catalog pricing checked on the release date.
- 12 tests passed, including provider request shape, routing, cost accounting, independent concurrency, retry limits, cancellation, non-JSON HTTP errors and truncated streams.
- Production build and TypeScript passed.
- The UI now uses the tested NDJSON parser, including actionable HTTP errors and incomplete-stream detection.
- Production live inference is opt-in with ENABLE_LIVE_RUNS=true. Deploy behind access protection before enabling paid inference.

The [announcement tweet](https://x.com/nutlope/status/2100614659690713543) describes an earlier run and provider configuration. Its timing, accuracy and cost are not the new Together AI recording's results. Raw current results and event timing are in data/recording.json.
