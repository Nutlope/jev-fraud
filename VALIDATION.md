# Validation — 2026-09-17

- Sample: 100 DIFrauD phishing test emails; 50 per label; seeded selection and full untruncated text saved.
- Core tests: 5 passed (boundary, failed-call cost accounting, label isolation and independent review, unresolved failed review).
- TypeScript: passed.
- Standard Next.js production build: passed (webpack).
- Browser: rendered dashboard; keyboard adjustment changed threshold 95 → 94; Escalated tab changed selected state; a clean reload and interactions produced no new browser errors. Earlier Vite hot-reload errors during the first Radix dependency load resolved on reload.
- WebMCP: read-only summary registered and returned expected metrics; unexpected input rejected intentionally.
- Live Kimi K3 smoke test: successful, 2,987 ms, 304 input tokens, 59 output tokens, provider-reported $0.0016242. This setup test is separate from dataset-run spend.
- Live Jev: authorized local gateway key reused successfully. Native confidence read from gateway provider metadata; provider-reported string cost parsed as a number.
- Full benchmark: all 100 completed; 69 Jev-only, 31 escalated; accuracy 90% Jev-only → 93% cascade; 3 fixes, 0 regressions; fraud recall 86%; no provider failures. Total $0.09239829945700404 ($0.002990736 Jev, $0.08940756345700399 Kimi). All costs provider-reported.
- Migration: Sites/Cloudflare build configuration and dependencies removed; standard Next.js App Router, local credentials preserved, Vercel deployment instructions in README.
- Recorded event stream and source data saved in data/recording.json. No fabricated outputs.
