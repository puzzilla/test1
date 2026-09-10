import calibration from "../data/calibration.json";
import type { CalibrationPoint, SpecialMapping } from "./types";
import { normalize } from "./search";

const points = (calibration.points as CalibrationPoint[]).slice().sort((a, b) => a.offset - b.offset);
const specials = calibration.specials as SpecialMapping[];

export function locatePhysicalPage(offset: number, evidence = "") {
  const normEvidence = normalize(evidence);
  for (const s of specials) {
    if (normEvidence.includes(normalize(s.match))) {
      return { physicalPage: s.physicalPage, line: s.line || null, confidence: s.confidence, note: "Exact special-layout mapping." as string | null };
    }
  }

  // Exact nearby text anchors take precedence.
  const exact = points.filter((p) => Math.abs(p.offset - offset) <= 18 && p.kind.includes("text"));
  if (exact.length) {
    const p = exact.sort((a, b) => Math.abs(a.offset - offset) - Math.abs(b.offset - offset))[0];
    return { physicalPage: String(p.physicalPage), line: p.line ? String(p.line) : null, confidence: "high" as const, note: "Directly supported by a hand-calibrated text anchor." };
  }

  let lo = points[0];
  let hi = points[points.length - 1];
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].offset <= offset && offset <= points[i + 1].offset) {
      lo = points[i];
      hi = points[i + 1];
      break;
    }
  }

  if (lo.physicalPage === hi.physicalPage) {
    return { physicalPage: String(lo.physicalPage), line: null, confidence: "high" as const, note: "Inside a verified physical-page boundary interval." };
  }

  const span = Math.max(1, hi.offset - lo.offset);
  const t = Math.max(0, Math.min(1, (offset - lo.offset) / span));
  const estimate = Math.round(lo.physicalPage + t * (hi.physicalPage - lo.physicalPage));
  const anchorDistancePages = Math.abs(hi.physicalPage - lo.physicalPage);
  const confidence = anchorDistancePages <= 5 ? "high" : anchorDistancePages <= 15 ? "medium" : "low";
  return {
    physicalPage: String(estimate),
    line: null,
    confidence,
    note: `Interpolated between calibrated physical pages ${lo.physicalPage} and ${hi.physicalPage}.`
  };
}
