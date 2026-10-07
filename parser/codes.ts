export interface CodeItem {
  code: string;
  reward?: string;
  source?: string;
}

export interface ArticleCodes {
  active: CodeItem[];
  expired: string[];
  placeId: number | null;
  ok: boolean;
}

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_!+\-.'?:]{1,49}$/;

export function isPlausibleCode(raw: string): boolean {
  const c = raw.trim().replace(/[:.,]+$/, '');
  if (c.length < 2 || c.length > 50) return false;
  return CODE_RE.test(c);
}

export function normalizeCode(raw: string): string {
  return raw.trim().replace(/[:.,]+$/, '');
}

const NOISE_PATTERNS: RegExp[] = [
  /\bnew\)?\s*$/i,
  /^\(new\)/i,
  /\bcopy\b/i,
  /\*\*/,
];

export function cleanCodeText(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  for (const p of NOISE_PATTERNS) t = t.replace(p, '');
  return t.trim();
}

export function extractReward(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/\(?\bnew\)?/gi, '').replace(/\bcopy\b/gi, '');
  t = t.replace(/\s{2,}/g, ' ').replace(/^[\s:.\-–—]+/, '').trim();
  if (t.length > 160) t = t.slice(0, 157).trim() + '…';
  return t;
}
