export type Chunk = {
  id: number;
  pdfPage: number;
  chapter: number | null;
  startOffset: number;
  endOffset: number;
  text: string;
  normalized: string;
};

export type CalibrationPoint = {
  offset: number;
  physicalPage: number;
  line?: number | null;
  kind: string;
  label: string;
};

export type SpecialMapping = {
  match: string;
  physicalPage: string;
  line?: string | null;
  confidence: "high" | "medium" | "low";
};
