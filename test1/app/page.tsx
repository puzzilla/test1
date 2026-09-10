"use client";

import { FormEvent, useState } from "react";

type SearchResult = {
  answer: string;
  physicalPage: string;
  line?: string | null;
  chapter?: number | null;
  pdfPage?: number | null;
  confidence: "high" | "medium" | "low";
  evidence: string;
  note?: string;
};

const examples = [
  "What page does Saad die?",
  "When do Hannah and Wyatt kiss?",
  "Where do the duels take place?",
  "What page does Rupert say ‘I miss them’?"
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">CALIBRATED BOOK SEARCH</div>
        <h1>The Most Dangerous Games<br />Locator</h1>
        <p className="lede">Describe a scene, quote, event, or character moment inexactly. The locator searches the book and returns the physical page in your calibrated edition.</p>

        <form onSubmit={search} className="searchBox">
          <textarea
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What page does Rupert say I miss them?"
            rows={3}
          />
          <div className="searchFooter">
            <span>Fuzzy descriptions • quotes • locations • events</span>
            <button disabled={!query.trim() || loading} type="submit">
              {loading ? "Searching…" : "Find it"}
            </button>
          </div>
        </form>

        <div className="examples">
          {examples.map((x) => (
            <button key={x} onClick={() => setQuery(x)}>{x}</button>
          ))}
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {result && (
        <section className="resultCard">
          <div className="pageBadge">
            <span>PHYSICAL PAGE</span>
            <strong>{result.physicalPage}</strong>
            {result.line && <small>line {result.line}</small>}
          </div>
          <div className="resultBody">
            <div className="meta">
              {result.chapter ? <span>Chapter {result.chapter}</span> : null}
              {result.pdfPage ? <span>PDF p. {result.pdfPage}</span> : null}
              <span className={`confidence ${result.confidence}`}>{result.confidence} confidence</span>
            </div>
            <h2>{result.answer}</h2>
            <blockquote>{result.evidence}</blockquote>
            {result.note && <p className="note">{result.note}</p>}
          </div>
        </section>
      )}

      <footer>
        Physical-page results use your hand-calibrated print-edition anchors. Exact anchors override interpolation.
      </footer>
    </main>
  );
}
