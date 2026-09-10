import type { Chunk } from "./types";

const STOP = new Set("a an the and or but if then than to of in on at for from with by is are was were be been being do does did what when where who how which that this these those they them their he she his her it its i you we our my your page pages book chapter say says said does during into out about".split(" "));
const ALIASES: Record<string, string[]> = {
  die: ["dead", "death", "dying", "killed", "kill", "bleed", "blood", "shot"],
  dies: ["dead", "death", "dying", "killed", "kill", "bleed", "blood", "shot"],
  died: ["dead", "death", "dying", "killed", "kill"],
  kiss: ["kissed", "kissing"],
  duels: ["duel", "guns", "revolvers", "shoot", "hunt"],
  duel: ["duels", "guns", "revolvers", "shoot", "hunt"],
  prince: ["saad", "harbi"],
  kid: ["rupert", "chadwick"],
  boy: ["rupert", "chadwick"],
  redhead: ["hannah", "wagner"],
  mountain: ["montana", "serpiente", "snake"],
  lighthouse: ["lighthouse", "chile", "island"],
  tuscany: ["tuscany", "tuscan", "florence", "estate"],
  kentucky: ["kentucky", "louisville", "cumberland", "appalachian"],
  saad: ["harbi", "prince"],
  hannah: ["wagner"],
  wyatt: ["jordan"],
  rupert: ["chadwick"],
  tipton: ["ant"],
  alek: ["andrich", "aleksandra"],
  jack: ["mchenry"],
  reg: ["drummond"]
};

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(t: string) {
  if (t.length > 5 && t.endsWith("ing")) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed")) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

export function queryTerms(query: string, extra: string[] = []) {
  const original = normalize(query).split(" ").filter(Boolean);
  const expanded = new Set<string>();
  for (const token of [...original, ...extra.flatMap((x) => normalize(x).split(" "))]) {
    if (!STOP.has(token) && token.length > 1) {
      expanded.add(token);
      expanded.add(stem(token));
      for (const alias of ALIASES[token] || []) expanded.add(alias);
    }
  }
  return [...expanded].filter((x) => x.length > 1);
}

function trigrams(s: string) {
  const compact = normalize(s).replace(/\s+/g, " ");
  const out = new Set<string>();
  for (let i = 0; i < compact.length - 2; i++) out.add(compact.slice(i, i + 3));
  return out;
}

function trigramSimilarity(a: string, b: string) {
  if (a.length < 5 || b.length < 5) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.max(1, Math.min(A.size, B.size));
}

export function retrieve(chunks: Chunk[], query: string, extraTerms: string[] = [], limit = 18) {
  const qNorm = normalize(query);
  const terms = queryTerms(query, extraTerms);
  const quoted = [...query.matchAll(/["“](.*?)["”]/g)].map((m) => normalize(m[1])).filter(Boolean);

  const scored = chunks.map((chunk) => {
    const text = chunk.normalized;
    let score = 0;
    let matched = 0;
    for (const term of terms) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "g");
      const count = (text.match(re) || []).length;
      if (count) {
        matched++;
        score += Math.min(4, count) * (term.length >= 6 ? 2.3 : 1.4);
      }
    }
    for (const phrase of quoted) {
      if (phrase.length > 2 && text.includes(phrase)) score += 35;
      else if (phrase.length > 5) score += trigramSimilarity(phrase, text) * 12;
    }
    if (qNorm.length > 12 && text.includes(qNorm)) score += 60;
    if (matched >= 2) score += matched * matched * 0.75;
    return { chunk, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
