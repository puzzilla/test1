import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { retrieve, normalize } from "../../../lib/search";
import { locatePhysicalPage } from "../../../lib/page-map";
import type { Chunk } from "../../../lib/types";
import groundTruth from "../../../data/ground-truth.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let chunksCache: Chunk[] | null = null;
function getChunks() {
  if (!chunksCache) {
    const p = path.join(process.cwd(), "data", "book-index.json");
    chunksCache = JSON.parse(fs.readFileSync(p, "utf8")) as Chunk[];
  }
  return chunksCache;
}

function cleanJson(text: string) {
  const stripped = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= start ? stripped.slice(start, end + 1) : stripped);
}

async function expandQuery(openai: OpenAI, model: string, query: string) {
  try {
    const r = await openai.responses.create({
      model,
      input: query,
      instructions: `Expand a fuzzy search query for a thriller novel. Return ONLY a compact comma-separated list of search terms, names, synonyms, likely wording, and event words. Do not answer the question. Known characters include Hannah Wagner, Wyatt Jordan, Rupert Chadwick, Saad al-Harbi, Ant Tipton, Jack McHenry, Alek Andrich, Reg Drummond, Luca Tommasi, Elena Torres, Jimmy, and The Host.`,
      reasoning: { effort: "low" },
      max_output_tokens: 100
    });
    return r.output_text.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 16);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Enter a query." }, { status: 400 });
    }

    const chunks = getChunks();
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
    let extraTerms: string[] = [];
    let openai: OpenAI | null = null;

    if (apiKey) {
      openai = new OpenAI({ apiKey });
      extraTerms = await expandQuery(openai, model, query);
    }

    const candidates = retrieve(chunks, query, extraTerms, 18);
    if (!candidates.length || candidates[0].score <= 0) {
      return NextResponse.json({ error: "I couldn't find a strong match in the book." }, { status: 404 });
    }

    let selected = candidates[0].chunk;
    let answer = "Best matching passage found.";
    let evidence = selected.text.slice(0, 420).trim();
    let evidenceOffset = selected.startOffset;
    let semanticConfidence: "high" | "medium" | "low" = candidates[0].score > 18 ? "high" : candidates[0].score > 8 ? "medium" : "low";

    if (openai) {
      const packet = candidates.slice(0, 12).map(({ chunk, score }) => ({
        id: chunk.id,
        chapter: chunk.chapter,
        pdfPage: chunk.pdfPage,
        retrievalScore: Number(score.toFixed(2)),
        text: chunk.text
      }));

      const r = await openai.responses.create({
        model,
        instructions: `You are a precision locator for one specific novel. Answer from the candidate excerpts supplied plus the CALIBRATED FACTS when they are directly relevant. Never invent a fact or page. The calibrated facts contain user-verified continuity/layout corrections and override a narrower inference from a candidate. Pick the single best candidate. Return JSON only with keys: chunkId (number), answer (one or two concise sentences), evidence (an exact short quote of at most 24 words copied from that candidate), confidence (high|medium|low). If the question asks when/where/what, answer that directly. If evidence is insufficient, say so and use low confidence.`,
        input: `USER QUERY:\n${query}\n\nCALIBRATED FACTS:\n${JSON.stringify(groundTruth)}\n\nCANDIDATES:\n${JSON.stringify(packet)}`,
        reasoning: { effort: "medium" },
        max_output_tokens: 260
      });

      try {
        const parsed = cleanJson(r.output_text) as { chunkId?: number; answer?: string; evidence?: string; confidence?: "high" | "medium" | "low" };
        const chosen = candidates.find((x) => x.chunk.id === parsed.chunkId)?.chunk;
        if (chosen) selected = chosen;
        if (parsed.answer) answer = parsed.answer;
        if (parsed.evidence) evidence = parsed.evidence;
        if (parsed.confidence) semanticConfidence = parsed.confidence;
      } catch {
        // Keep deterministic local fallback.
      }
    }

    // Locate the evidence within the chosen chunk for the best physical-page interpolation point.
    const nEvidence = normalize(evidence);
    const pos = nEvidence ? selected.normalized.indexOf(nEvidence) : -1;
    if (pos >= 0) {
      const ratio = pos / Math.max(1, selected.normalized.length);
      evidenceOffset = Math.round(selected.startOffset + ratio * (selected.endOffset - selected.startOffset));
    } else {
      evidenceOffset = Math.round((selected.startOffset + selected.endOffset) / 2);
    }

    const mapped = locatePhysicalPage(evidenceOffset, `${query} ${evidence}`);
    const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };
    const finalConfidence = (rank[semanticConfidence] < rank[mapped.confidence] ? semanticConfidence : mapped.confidence) as "high" | "medium" | "low";

    return NextResponse.json({
      answer,
      physicalPage: mapped.physicalPage,
      line: mapped.line,
      chapter: selected.chapter,
      pdfPage: selected.pdfPage,
      confidence: finalConfidence,
      evidence,
      note: mapped.note
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Search failed. Check your deployment logs and OPENAI_API_KEY." }, { status: 500 });
  }
}
