"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { summarize } from "@/lib/pipeline.mjs";
import { consumeRun } from "@/lib/run-client.mjs";
import emails from "@/data/emails.json";

type Row = (typeof emails)[number] & {
  jev?: any;
  kimi?: any;
  final?: string;
  escalated?: boolean;
  error?: string;
  status?: string;
  stage?: string;
  failedCalls?: any[];
};
type Recording = { rows: Row[]; events: any[]; threshold: number; durationMs?: number; startedAt?: string };
type Filter = "all" | "escalated" | "fraud" | "misses";

const money = (n: number) => "$" + n.toFixed(n < 0.01 ? 5 : 4);
const pct = (n: number) => {
  const v = n * 100;
  return (Math.abs(v - Math.round(v)) < 0.05 ? v.toFixed(0) : v.toFixed(1)) + "%";
};

/* ------------------------------------------------------------------ */
/* Glyphs (custom, no icon library)                                    */
/* ------------------------------------------------------------------ */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Icon = {
  play: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...stroke}>
      <path d="M4 2.5v9l7-4.5z" fill="currentColor" />
    </svg>
  ),
  stop: (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 14 14" {...stroke}>
      <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" />
    </svg>
  ),
  external: (
    <svg width="11" height="11" viewBox="0 0 12 12" {...stroke}>
      <path d="M3.5 2.5h6v6M9.5 2.5 2.5 9.5" />
    </svg>
  ),
  download: (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  ),
  reset: (
    <svg width="15" height="15" viewBox="0 0 16 16" {...stroke}>
      <path d="M3 8a5 5 0 1 0 1.6-3.66M3 2.5v3h3" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  ),
  check: (
    <svg width="10" height="10" viewBox="0 0 10 10" {...stroke} strokeWidth={1.75}>
      <path d="m2 5.2 2.2 2.2L8 3" />
    </svg>
  ),
  cross: (
    <svg width="9" height="9" viewBox="0 0 10 10" {...stroke} strokeWidth={1.75}>
      <path d="m2.5 2.5 5 5M7.5 2.5l-5 5" />
    </svg>
  ),
  inbox: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...stroke}>
      <path d="M3 5h12M3 9h9M3 13h6" />
    </svg>
  ),
  jev: (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="4" fill="currentColor" />
      <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
    </svg>
  ),
  gate: (
    <svg width="22" height="22" viewBox="0 0 22 22" {...stroke}>
      <path d="M11 2.5 19.5 11 11 19.5 2.5 11z" />
    </svg>
  ),
  kimi: (
    <svg width="18" height="18" viewBox="0 0 18 18" {...stroke}>
      <circle cx="9" cy="9" r="6.5" />
      <circle cx="9" cy="9" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
};

function Mark() {
  return (
    <svg className="brand-mark" width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="11" cy="16" r="4" fill="var(--jev)" />
      <circle cx="21" cy="16" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [rows, setRows] = useState<Row[]>(emails.map((email) => ({ ...email, stage: "queued" })));
  const [recording, setRecording] = useState<Recording | null>(null);
  const [threshold, setThreshold] = useState(95);
  const [applied, setApplied] = useState(95);
  const [mode, setMode] = useState<"live" | "replay" | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const cancel = useRef<AbortController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const start = useRef(0);
  const latest = useRef<Row[]>([]);
  const activeThreshold = useRef(95);

  useEffect(() => {
    fetch("/api/recording")
      .then((r) => r.json() as Promise<Recording>)
      .then((d: Recording) => {
        setRecording(d);
        if (d.rows?.length) {
          setRows(d.rows);
          latest.current = d.rows;
          setThreshold(d.threshold * 100);
          activeThreshold.current = d.threshold * 100;
          setApplied(d.threshold * 100);
          setMode("replay");
          setElapsed(d.durationMs ?? 0);
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
        setNotice("Recorded run could not be loaded.");
      });
    return () => {
      cancel.current?.abort();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "get_fraud_run_summary",
            title: "Read fraud run summary",
            description: "Read the visible run summary without starting paid inference or changing state.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute(input: unknown) {
              if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length)
                throw Error("Expected an empty object");
              return { threshold: activeThreshold.current / 100, ...summarize(latest.current) };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed(Date.now() - start.current), 100);
    return () => clearInterval(timer);
  }, [busy]);

  function apply(event: any) {
    if (event.type === "stage") {
      setRows((prev) => {
        const old = prev.find((r) => r.id === event.id);
        const next = old
          ? prev.map((r) => (r.id === event.id ? { ...r, stage: event.stage } : r))
          : [...prev, { ...emails.find((e) => e.id === event.id)!, stage: event.stage }];
        latest.current = next;
        return next;
      });
    } else if (event.row) {
      setRows((prev) => {
        const next = [
          ...prev.filter((r) => r.id !== event.row.id),
          { ...event.row, stage: event.type === "result" ? "done" : event.row.escalated ? "kimi" : "done" },
        ];
        latest.current = next;
        return next;
      });
    }
  }

  function stop() {
    cancel.current?.abort();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBusy(false);
    setNotice(
      mode === "live"
        ? "Stopped. Requests already sent may still be billed; partial results remain visible."
        : "Replay paused. Start again to replay from the beginning.",
    );
  }

  function reset() {
    setRows(emails.map((email) => ({ ...email, stage: "queued" })));
    latest.current = emails;
    setElapsed(0);
    setNotice("");
    setSelected(null);
    setMode(null);
  }

  function replay() {
    if (!recording?.rows.length) return;
    reset();
    setMode("replay");
    setBusy(true);
    setThreshold(recording.threshold * 100);
    activeThreshold.current = recording.threshold * 100;
    setApplied(recording.threshold * 100);
    start.current = Date.now();
    const events = recording.events?.length
      ? recording.events
      : recording.rows.map((row, i) => ({ type: "result", row, at: i * 100 }));
    const end = Math.max(...events.map((e) => e.at), 1);
    for (const event of events) timers.current.push(setTimeout(() => apply(event), (event.at / end) * 9500));
    timers.current.push(
      setTimeout(() => {
        setRows(recording.rows);
        latest.current = recording.rows;
        setBusy(false);
        setElapsed(10000);
      }, 10000),
    );
  }

  async function live() {
    reset();
    activeThreshold.current = threshold;
    setApplied(threshold);
    setMode("live");
    setBusy(true);
    start.current = Date.now();
    const abort = new AbortController();
    cancel.current = abort;
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: threshold / 100 }),
        signal: abort.signal,
      });
      await consumeRun(response, (event) => {
        if (event.type === "done") {
          setRows(event.rows);
          latest.current = event.rows;
          if (event.rows.length < 100 || event.summary?.errors) setNotice("Some requests failed. Completed decisions remain visible; inspect the unresolved emails.");
        } else if (event.type === "retry") {
          setNotice(`${event.model === "jev" ? "Jev" : "Kimi"} rate limit: retrying with ${event.concurrency} concurrent calls.`);
        } else apply(event);
      });
    } catch (e: any) {
      if (e.name !== "AbortError") setNotice(e.message);
    } finally {
      setElapsed(Date.now() - start.current);
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            mode,
            threshold: activeThreshold.current / 100,
            summary: summarize(rows),
            rows,
            source: "https://huggingface.co/datasets/difraud/difraud",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relay-fraud-results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------------------------------------------------------- */
  /* Derived                                                           */
  /* ---------------------------------------------------------------- */

  const summary = summarize(rows);
  const classified: number = summary.completed;
  const finished = classified === 100;
  const accuracy = classified ? summary.correct / classified : 0;
  const jevAccuracy = summary.jevCount ? summary.jevCorrect / summary.jevCount : 0;
  const deltaPts = classified && summary.jevCount ? (accuracy - jevAccuracy) * 100 : 0;
  const shareJev = summary.jevCount ? summary.accepted / summary.jevCount : 0;
  const kimiSpendShare = summary.cost ? summary.kimiCost / summary.cost : 0;
  const shownThreshold = busy || summary.jevCount ? applied : threshold;

  const isMiss = (r: Row) => !!r.error || (!!r.final && r.final !== r.label);
  const counts = {
    all: rows.length,
    escalated: rows.filter((r) => r.escalated).length,
    fraud: rows.filter((r) => r.final === "fraud").length,
    misses: rows.filter(isMiss).length,
  };
  const visible = [...rows]
    .reverse()
    .filter(
      (r) =>
        (filter === "all" ||
          (filter === "escalated" && r.escalated) ||
          (filter === "fraud" && r.final === "fraud") ||
          (filter === "misses" && isMiss(r))) &&
        (!query || `${r.id} ${r.text}`.toLowerCase().includes(query.toLowerCase())),
    );
  const selectedRow = selected ? rows.find((r) => r.id === selected.id) ?? selected : null;
  const current = rows.filter((r) => r.stage === "kimi" || r.stage === "jev").at(-1);

  const statusText = busy
    ? mode === "replay"
      ? "Replaying recorded run"
      : "Live inference"
    : finished
      ? "Run complete"
      : "Ready";

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "escalated", label: "Escalated" },
    { key: "fraud", label: "Fraud" },
    { key: "misses", label: "Misses" },
  ];

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <main className="page">
      <header className="top">
        <Link className="brand" href="/">
          <Mark />
          Relay
          <span className="brand-sub">Confidence-gated fraud detection</span>
        </Link>
        <div className="top-right">
          <div className="made-with">
            <span>Built with</span>
            <b>Typesafe AI</b>
            <span>×</span>
            <img className="together" src="/together-ai.svg" alt="Together AI" />
          </div>
          <a className="top-link" href="https://huggingface.co/datasets/difraud/difraud" target="_blank" rel="noreferrer">
            Dataset {Icon.external}
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            <i />
            Jev × Kimi K3 · 100 real emails<span className="eyebrow-extra"> · real API calls</span>
          </div>
          <h1>
            Fast where it&rsquo;s sure.
            <br />
            <em>Careful</em> where it isn&rsquo;t.
          </h1>
          <p>
            <b>Jev</b>, the calibrated decision model from Typesafe AI, classifies every email in about a quarter
            of a second. When its confidence dips below the threshold, <b>Kimi K3</b> on Together AI reviews the
            case independently. Watch each decision arrive, with routing, accuracy, and inference costs in view.
          </p>
        </div>
        <div className="hero-actions">
          <div className="btn-row">
            {busy ? (
              <button className="btn btn-ghost" onClick={stop}>
                {Icon.stop} Stop {mode === "replay" ? "replay" : "run"}
              </button>
            ) : (
              <>
                <button className="btn btn-ghost" disabled={!recording?.rows.length} onClick={replay}>
                  {Icon.play} Replay recorded run
                </button>
                <button className="btn btn-primary" onClick={live}>
                  Run live {Icon.arrow}
                </button>
              </>
            )}
          </div>
          <span className="action-note">
            {busy
              ? mode === "replay"
                ? "Recorded API results, compressed to ten seconds."
                : "Live inference · five emails in flight."
              : recording?.rows.length
                ? "Replay is free. A live run makes real, paid API calls."
                : "100 labeled emails, ready to classify."}
          </span>
        </div>
      </section>

      {notice && (
        <div className="notice" role="alert">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <section className={`pipeline ${busy ? "running" : ""}`}>
        <div className="pipeline-head">
          <span className="status">
            <i className={`status-dot ${busy ? "live" : finished ? "done" : ""}`} />
            {statusText}
          </span>
          <div className="threshold">
            <label htmlFor="confidence-slider">
              Escalate below <b>{threshold}%</b>
            </label>
            <Slider
              id="confidence-slider"
              aria-label="Confidence threshold"
              min={50}
              max={100}
              step={1}
              value={[threshold]}
              disabled={busy}
              onValueChange={([v]) => setThreshold(v)}
            />
          </div>
        </div>

        <div className="flow">
          <div className="node">
            <div className="node-glyph">{Icon.inbox}</div>
            <div className="node-title">Inbox</div>
            <div className="node-meta">100 emails · 50 fraud · 50 legitimate</div>
          </div>
          <div className="wire jev">
            <i />
          </div>
          <div className={`node jev ${current?.stage === "jev" ? "working" : ""}`}>
            <div className="node-glyph">{Icon.jev}</div>
            <div className="node-title">
              Jev <span className="node-tag">Typesafe AI</span>
            </div>
            <div className="node-meta">
              {summary.jevCount
                ? `${summary.jevCount} decisions · ${summary.jevMedianMs} ms median`
                : "Typed decision with calibrated confidence"}
            </div>
          </div>
          <div className="wire jev">
            <i />
          </div>
          <div className="gate">
            <div className="gate-glyph">{Icon.gate}</div>
            <div className="gate-rule">
              ≥ {shownThreshold}% <span>accept</span>
            </div>
            <div className="gate-meta">below → escalate</div>
          </div>
          <div className="wire kimi">
            <i />
          </div>
          <div className={`node kimi ${current?.stage === "kimi" ? "working" : ""}`}>
            <div className="node-glyph">{Icon.kimi}</div>
            <div className="node-title">
              Kimi K3 <span className="node-tag">Together AI</span>
            </div>
            <div className="node-meta">
              {summary.escalated
                ? `${summary.reviewed} reviewed · ${summary.changed} overturned`
                : "Independent second opinion"}
            </div>
          </div>
        </div>

        <div className="pipeline-foot">
          <span>
            {busy
              ? current
                ? `${current.id} · ${current.stage === "kimi" ? "Kimi K3 is reviewing" : "Jev is deciding"}…`
                : "Starting pipeline…"
              : finished
                ? `${summary.accepted} decided by Jev alone · ${summary.escalated} sent to Kimi K3`
                : "Confident decisions stay fast. Uncertain ones get a second look."}
          </span>
          <span className="mono">
            {mode === "replay" ? "Recorded" : mode === "live" ? "Live" : "Idle"}
            {elapsed > 0 ? ` · ${(elapsed / 1000).toFixed(1)}s` : ""}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-label="Emails classified" aria-valuenow={classified} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${classified}%` }} />
        </div>
      </section>

      <section className="stats">
        <div className="stat">
          <div className="stat-label">Accuracy against labels</div>
          <div className="stat-value">
            {classified ? pct(accuracy) : "—"}
            {finished && deltaPts !== 0 && (
              <span className={`delta ${deltaPts < 0 ? "neg" : ""}`}>
                {deltaPts > 0 ? "+" : ""}
                {deltaPts.toFixed(1)} pts
              </span>
            )}
          </div>
          <div className="stat-foot">
            {summary.jevCount ? (
              <>
                Jev alone <b>{pct(jevAccuracy)}</b> · review fixed <b>{summary.fixed}</b>, broke <b>{summary.regressed}</b>
              </>
            ) : (
              "Scored against dataset labels the models never see"
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Decided by Jev alone</div>
          <div className="stat-value">
            {summary.jevCount ? pct(shareJev) : "—"}
            <small>of {summary.jevCount || 100}</small>
          </div>
          <div className="stat-foot">
            {summary.jevCount ? (
              <>
                <b>{summary.escalated}</b> escalated below {shownThreshold}% confidence
              </>
            ) : (
              "Only uncertain cases escalate"
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Fraud recall</div>
          <div className="stat-value">{summary.recall === null || !classified ? "—" : pct(summary.recall)}</div>
          <div className="stat-foot">
            {classified ? (
              <>
                <b>{summary.tp}</b> of {summary.tp + summary.fn} fraud caught · <b>{summary.fp}</b> false alarms
              </>
            ) : (
              "Share of real fraud flagged"
            )}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Total spend</div>
          <div className="stat-value">{summary.jevCount ? money(summary.cost) : "$0.0000"}</div>
          <div className="stat-foot">
            {!summary.jevCount ? (
              "No API calls in this view"
            ) : summary.unknownCosts ? (
              "Partial total · some costs unavailable"
            ) : (
              <>
                <b>{money(summary.jevCost)}</b> Jev · <b>{money(summary.kimiCost)}</b> Kimi K3
                {summary.estimatedCosts ? " · includes estimates" : ""}
              </>
            )}
          </div>
        </div>
      </section>

      <div className="results">
        <section className="panel">
          <div className="panel-head">
            <h2>
              Decisions <span className="count num">{rows.length}</span>
            </h2>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="icon-btn" title="Reset view" aria-label="Reset view" disabled={busy} onClick={reset}>
                {Icon.reset}
              </button>
              <button className="icon-btn" title="Export results as JSON" aria-label="Export results" disabled={!rows.length || busy} onClick={download}>
                {Icon.download}
              </button>
            </div>
          </div>
          <div className="panel-tools">
            <div className="seg" role="group" aria-label="Filter decisions">
              {filters.map((f) => (
                <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label}
                  <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <label className="search">
              {Icon.search}
              <input aria-label="Search emails" placeholder="Search emails" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Jev confidence</th>
                  <th>Route</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const conf: number | undefined = row.jev?.confidence;
                  return (
                    <tr key={row.id} className={row.stage === "kimi" ? "reviewing" : ""}>
                      <td>
                        <button className="email-cell" onClick={() => setSelected(row)}>
                          <span className="email-id">
                            {row.id} {Icon.external}
                          </span>
                          <p className="email-preview">{row.text.slice(0, 110)}</p>
                        </button>
                      </td>
                      <td>
                        {conf !== undefined ? (
                          <div className="conf">
                            <b>{pct(conf)}</b>
                            <div className={`conf-bar ${row.escalated ? "low" : ""}`}>
                              <i style={{ width: `${conf * 100}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="muted">{row.stage === "queued" ? "—" : "Deciding…"}</span>
                        )}
                      </td>
                      <td>
                        {row.escalated ? (
                          <span className="route kimi">
                            <i /> Kimi K3 <small>review</small>
                          </span>
                        ) : row.jev ? (
                          <span className="route">
                            <i /> Jev <small>direct</small>
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="verdict">
                          {row.final ? (
                            <span className={`pill ${row.final === "fraud" ? "fraud" : "legitimate"}`}>
                              {row.final === "fraud" ? "Fraud" : "Legitimate"}
                            </span>
                          ) : row.error ? (
                            <span className="pill fraud">Failed</span>
                          ) : (
                            <span className={`pill pending ${row.stage === "kimi" ? "kimi" : ""}`}>
                              {row.stage === "kimi" ? "Reviewing…" : row.stage === "queued" ? "Queued" : "Deciding…"}
                            </span>
                          )}
                          {row.final && (
                            <span
                              className={`check ${row.final === row.label ? "hit" : "miss"}`}
                              title={row.final === row.label ? "Matches dataset label" : "Disagrees with dataset label"}
                            >
                              {row.final === row.label ? Icon.check : Icon.cross}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && (
              <div className="empty">
                <h3>{rows.length ? "No matching emails" : loaded ? "Pipeline ready" : "Loading recorded results…"}</h3>
                <p>{rows.length ? "Try another filter or search term." : "Run live to watch Jev decide and Kimi K3 review."}</p>
              </div>
            )}
          </div>
        </section>

        <aside className="panel">
          <div className="panel-head">
            <h2>Where the work goes</h2>
          </div>
          <div className="aside-body">
            <div className="split">
              <div className="split-head">
                Volume <b>{summary.jevCount ? pct(shareJev) : "—"} Jev</b>
              </div>
              <div className="split-bar">
                <i style={{ width: `${shareJev * 100}%` }} />
                <i style={{ width: `${summary.jevCount ? (summary.escalated / summary.jevCount) * 100 : 0}%` }} />
              </div>
              <div className="split-legend">
                <span>
                  <i /> Jev only <b>{summary.accepted}</b>
                </span>
                <span>
                  <i /> Kimi K3 review <b>{summary.escalated}</b>
                </span>
              </div>
            </div>

            <div className="split">
              <div className="split-head">
                Spend <b>{summary.cost ? pct(kimiSpendShare) : "—"} Kimi K3</b>
              </div>
              <div className="split-bar">
                <i style={{ width: `${summary.cost ? (summary.jevCost / summary.cost) * 100 : 0}%` }} />
                <i style={{ width: `${kimiSpendShare * 100}%` }} />
              </div>
              <div className="split-legend">
                <span>
                  <i /> Jev <b>{money(summary.jevCost)}</b>
                </span>
                <span>
                  <i /> Kimi K3 <b>{money(summary.kimiCost)}</b>
                </span>
              </div>
            </div>

            <div className="aside-rule" />

            <div className="kv">
              <div>
                <span>Decisions overturned by review</span>
                <b>{summary.changed}</b>
              </div>
              <div>
                <span>Fixed / regressed</span>
                <b className={summary.fixed > summary.regressed ? "good" : ""}>
                  {summary.fixed} / {summary.regressed}
                </b>
              </div>
              <div>
                <span>Precision</span>
                <b>{summary.precision === null || !classified ? "—" : pct(summary.precision)}</b>
              </div>
              <div>
                <span>Jev median latency</span>
                <b>{summary.jevCount ? `${summary.jevMedianMs} ms` : "—"}</b>
              </div>
              <div>
                <span>Cost per email</span>
                <b>{classified && summary.cost ? money(summary.cost / classified) : "—"}</b>
              </div>
            </div>

            <div className="aside-note">
              {summary.jevCount && summary.cost ? (
                <>
                  Kimi K3 saw <b>{pct(summary.escalated / summary.jevCount)}</b> of the emails and accounted for{" "}
                  <b>{pct(kimiSpendShare)}</b> of the spend. That is the point: pay for deep reasoning only where Jev
                  is unsure.
                </>
              ) : (
                <>Accuracy is scored against dataset labels. Neither model ever sees them.</>
              )}
            </div>
          </div>
        </aside>
      </div>

      <footer className="foot">
        <p>
          Relay is a demonstration of confidence-gated inference on 100 phishing emails from{" "}
          <a href="https://huggingface.co/datasets/difraud/difraud" target="_blank" rel="noreferrer">
            DIFrauD
          </a>
          , balanced 50/50. Confidence is not accuracy, and a balanced sample is not production prevalence. Labels are
          used only for scoring.
        </p>
        <div className="foot-brands">
          <span>
            Decisions by <b className="typesafe">Typesafe AI</b>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Review by <img className="together" src="/together-ai.svg" alt="Together AI" />
          </span>
        </div>
      </footer>

      <Sheet
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="sheet">
          <SheetHeader>
            <SheetTitle>{selectedRow?.id} · Decision detail</SheetTitle>
            <SheetDescription>The original email, how it was routed, and what each model said.</SheetDescription>
          </SheetHeader>
          {selectedRow && (
            <div className="sheet-body">
              <div className="sheet-label">Email · untrusted text</div>
              <p className="email-text">{selectedRow.text}</p>

              <div className="sheet-label jev">Jev decision</div>
              <div className="decision-row">
                {selectedRow.jev ? (
                  <>
                    <span className={`pill ${selectedRow.jev.choice === "fraud" ? "fraud" : "legitimate"}`}>
                      {selectedRow.jev.choice === "fraud" ? "Fraud" : "Legitimate"}
                    </span>
                    <span className="mono">
                      {pct(selectedRow.jev.confidence)} {selectedRow.jev.confidenceBasis ?? "confidence"}
                    </span>
                  </>
                ) : (
                  <span className="pill pending">Pending</span>
                )}
              </div>
              <p className="sheet-sub">
                {!selectedRow.jev
                  ? "Awaiting classification."
                  : selectedRow.escalated
                    ? `Below the ${applied}% threshold, so the case was escalated to Kimi K3.`
                    : `At or above the ${applied}% threshold, so Jev's decision was accepted directly.`}
              </p>

              {selectedRow.kimi && (
                <>
                  <div className="sheet-label kimi">Kimi K3 · independent review</div>
                  <div className="decision-row">
                    <span className={`pill ${selectedRow.kimi.choice === "fraud" ? "fraud" : "legitimate"}`}>
                      {selectedRow.kimi.choice === "fraud" ? "Fraud" : "Legitimate"}
                    </span>
                    {selectedRow.jev && selectedRow.kimi.choice !== selectedRow.jev.choice && (
                      <span className="mono">overturned Jev</span>
                    )}
                  </div>
                  <p className="reason">{selectedRow.kimi.reason}</p>
                </>
              )}

              <div className="sheet-label">Evaluation</div>
              <div className="decision-row">
                <span className="mono">Label</span>
                <span className={`pill ${selectedRow.label === "fraud" ? "fraud" : "legitimate"}`}>
                  {selectedRow.label === "fraud" ? "Fraud" : "Legitimate"}
                </span>
                <span className="mono">Final</span>
                {selectedRow.final ? (
                  <span className={`pill ${selectedRow.final === "fraud" ? "fraud" : "legitimate"}`}>
                    {selectedRow.final === "fraud" ? "Fraud" : "Legitimate"}
                  </span>
                ) : (
                  <span className="pill pending">Unresolved</span>
                )}
              </div>
              <p className="sheet-sub">
                Source test row {selectedRow.sourceRow}. Labels are never included in model requests.
              </p>
              {selectedRow.error && <p className="notice">{selectedRow.error}</p>}

              <div className="sheet-label">Usage</div>
              <div className="usage">
                <div>
                  Jev latency<b>{selectedRow.jev?.ms ?? "—"} ms</b>
                </div>
                <div>
                  Jev input tokens<b>{selectedRow.jev?.inputTokens ?? "—"}</b>
                </div>
                {selectedRow.kimi && (
                  <>
                    <div>
                      Kimi K3 latency<b>{(selectedRow.kimi.ms / 1000).toFixed(1)} s</b>
                    </div>
                    <div>
                      Kimi K3 output tokens<b>{selectedRow.kimi.outputTokens}</b>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
